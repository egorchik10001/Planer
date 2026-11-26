#ifndef PLANNER_VOICE_H
#define PLANNER_VOICE_H
#include <stdbool.h>
#ifdef __cplusplus
extern "C" {
#endif
char *planner_transcribe(const char *model, const float *samples, int count, bool use_gpu);
char *planner_interpret(const char *model, const char *prompt, bool use_gpu);
void planner_voice_release(char *value);
#ifdef __cplusplus
}
#endif
#endif
