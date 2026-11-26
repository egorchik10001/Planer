#include "PlannerVoice.h"
#include "whisper.h"
#include "llama.h"
#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

using Clock = std::chrono::steady_clock;

char *planner_transcribe(const char *model,const float *samples,int count,bool use_gpu) {
    try {
        if (!samples || count <= 0 || count > 182 * WHISPER_SAMPLE_RATE) return nullptr;
        auto cfg = whisper_context_default_params();
        cfg.use_gpu = use_gpu;
        std::unique_ptr<whisper_context,decltype(&whisper_free)> context(
            whisper_init_from_file_with_params(model,cfg),whisper_free);
        if (!context) return nullptr;
        auto params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        params.n_threads = 4;
        params.language = "ru";
        params.no_context = true;
        params.no_timestamps = true;
        params.print_progress = false;
        params.print_realtime = false;
        params.print_timestamps = false;
        params.print_special = false;
        if (whisper_full(context.get(),params,samples,count) != 0) return nullptr;
        std::string transcript;
        for (int i=0;i<whisper_full_n_segments(context.get());++i) {
            transcript += whisper_full_get_segment_text(context.get(),i);
        }
        return strdup(transcript.c_str());
    } catch (...) { return nullptr; }
}

static constexpr auto object_grammar = R"GRAMMAR(
root ::= object
object ::= "{" ws (string ws ":" ws value ("," ws string ws ":" ws value)*)? "}"
array ::= "[" ws (value ("," ws value)*)? "]"
value ::= (object | array | string | number | "true" | "false" | "null") ws
string ::= "\"" ([^"\\\x00-\x1F] | "\\" (["\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]))* "\""
number ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
ws ::= [ \t\n\r]*
)GRAMMAR";

struct JSONEnd {
    int depth=0;
    bool started=false,quoted=false,escaped=false;
    bool scan(const char *bytes,int length) {
        for (int i=0;i<length;i++) {
            const char c=bytes[i];
            if(escaped){escaped=false;continue;}
            if(quoted&&c=='\\'){escaped=true;continue;}
            if(c=='"'){quoted=!quoted;continue;}
            if(quoted)continue;
            if(c=='{'||c=='['){started=true;depth++;}
            if(c=='}'||c==']')depth--;
            if(started&&depth==0)return true;
        }
        return false;
    }
};

char *planner_interpret(const char *model_path,const char *prompt,bool use_gpu) {
    try {
        llama_backend_init();
        auto model_params=llama_model_default_params();
        model_params.n_gpu_layers=use_gpu?99:0;
        std::unique_ptr<llama_model,decltype(&llama_model_free)> model(
            llama_model_load_from_file(model_path,model_params),llama_model_free);
        if(!model)return nullptr;
        const auto *vocab=llama_model_get_vocab(model.get());
        const int length=static_cast<int>(std::strlen(prompt));
        constexpr int context_length=8192, chunk_size=256, output_limit=1200;
        std::vector<llama_token> tokens(context_length);
        const int count=llama_tokenize(vocab,prompt,length,tokens.data(),tokens.size(),false,true);
        if(count<=0||count+output_limit>context_length)return nullptr;
        auto params=llama_context_default_params();
        params.n_ctx=context_length;
        params.n_batch=chunk_size;
        params.n_ubatch=chunk_size;
        params.n_threads=4;
        params.n_threads_batch=4;
        std::unique_ptr<llama_context,decltype(&llama_free)> context(llama_init_from_model(model.get(),params),llama_free);
        if(!context)return nullptr;
        const auto deadline=Clock::now()+std::chrono::minutes(4);
        for(int start=0;start<count;start+=chunk_size){
            if(Clock::now()>deadline||llama_decode(context.get(),llama_batch_get_one(tokens.data()+start,std::min(chunk_size,count-start)))!=0)return nullptr;
        }
        std::unique_ptr<llama_sampler,decltype(&llama_sampler_free)> sampler(
            llama_sampler_chain_init(llama_sampler_chain_default_params()),llama_sampler_free);
        if(!sampler)return nullptr;
        auto *grammar=llama_sampler_init_grammar(vocab,object_grammar,"root");
        if(!grammar)return nullptr;
        llama_sampler_chain_add(sampler.get(),grammar);
        llama_sampler_chain_add(sampler.get(),llama_sampler_init_greedy());
        std::string response;
        JSONEnd end;
        for(int i=0;i<output_limit&&Clock::now()<deadline;i++){
            llama_token token=llama_sampler_sample(sampler.get(),context.get(),-1);
            if(llama_vocab_is_eog(vocab,token))break;
            char piece[512];
            int length=llama_token_to_piece(vocab,token,piece,sizeof(piece),0,false);
            if(length<0)break;
            response.append(piece,length);
            if(end.scan(piece,length))return strdup(response.c_str());
            if(llama_decode(context.get(),llama_batch_get_one(&token,1))!=0)break;
        }
        return nullptr;
    } catch (...) { return nullptr; }
}

void planner_voice_release(char *value){std::free(value);}
