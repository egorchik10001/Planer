#define NAPI_VERSION 8
#include <node_api.h>
#import <Cocoa/Cocoa.h>
#import <Security/Security.h>
#import <Sparkle/Sparkle.h>

static NSString *const service=@"app.planner.personal.ai";
static NSString *const account=@"OpenAI";
static SPUStandardUpdaterController *controller;
@interface PlannerUpdaterDelegate : NSObject<SPUUpdaterDelegate>
@property(nonatomic,copy) NSString *feed;
@end
@implementation PlannerUpdaterDelegate
- (NSString *)feedURLStringForUpdater:(SPUUpdater *)updater { return self.feed; }
@end
static PlannerUpdaterDelegate *updaterDelegate;
static napi_value text(napi_env env,NSString *string){napi_value result;napi_create_string_utf8(env,string.UTF8String,NAPI_AUTO_LENGTH,&result);return result;}
static napi_value empty(napi_env env){napi_value result;napi_get_null(env,&result);return result;}
static NSString *argument(napi_env env,napi_callback_info info){size_t count=1;napi_value arg;napi_get_cb_info(env,info,&count,&arg,NULL,NULL);if(count!=1){napi_throw_type_error(env,NULL,"Expected one string");return nil;}size_t length=0;if(napi_get_value_string_utf8(env,arg,NULL,0,&length)!=napi_ok||length>4096){napi_throw_type_error(env,NULL,"Invalid string");return nil;}char *buffer=new char[length+1];napi_get_value_string_utf8(env,arg,buffer,length+1,&length);NSString *value=[[NSString alloc] initWithBytes:buffer length:length encoding:NSUTF8StringEncoding];delete[] buffer;return value;}
static NSMutableDictionary *query(){return [@{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword,(__bridge id)kSecAttrService:service,(__bridge id)kSecAttrAccount:account} mutableCopy];}
static napi_value getKey(napi_env env,napi_callback_info info){NSMutableDictionary *q=query();q[(__bridge id)kSecReturnData]=@YES;q[(__bridge id)kSecMatchLimit]=(__bridge id)kSecMatchLimitOne;CFTypeRef result=NULL;OSStatus status=SecItemCopyMatching((__bridge CFDictionaryRef)q,&result);if(status==errSecItemNotFound)return empty(env);if(status!=errSecSuccess){napi_throw_error(env,NULL,"Не удалось открыть ключ в Связке ключей Mac.");return NULL;}NSData *data=CFBridgingRelease(result);return text(env,[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding]);}
static napi_value setKey(napi_env env,napi_callback_info info){NSString *key=argument(env,info);if(!key)return NULL;NSData *data=[key dataUsingEncoding:NSUTF8StringEncoding];NSMutableDictionary *q=query();OSStatus status=SecItemUpdate((__bridge CFDictionaryRef)q,(__bridge CFDictionaryRef)@{(__bridge id)kSecValueData:data});if(status==errSecItemNotFound){q[(__bridge id)kSecValueData]=data;status=SecItemAdd((__bridge CFDictionaryRef)q,NULL);}if(status!=errSecSuccess){napi_throw_error(env,NULL,"Не удалось сохранить ключ в Связке ключей Mac.");return NULL;}return empty(env);}
static napi_value clearKey(napi_env env,napi_callback_info info){OSStatus status=SecItemDelete((__bridge CFDictionaryRef)query());if(status!=errSecSuccess&&status!=errSecItemNotFound){napi_throw_error(env,NULL,"Не удалось удалить ключ.");return NULL;}return empty(env);}
static napi_value startUpdates(napi_env env,napi_callback_info info){NSString *feed=argument(env,info);if(!feed)return NULL;if(![NSThread isMainThread]){napi_throw_error(env,NULL,"Updater requires main thread");return NULL;}
 if(!controller){updaterDelegate=[PlannerUpdaterDelegate new];updaterDelegate.feed=feed;controller=[[SPUStandardUpdaterController alloc]initWithStartingUpdater:NO updaterDelegate:updaterDelegate userDriverDelegate:nil];NSError *error=nil;if(![controller.updater startUpdater:&error]){controller=nil;napi_throw_error(env,NULL,error.localizedDescription.UTF8String);return NULL;}controller.updater.automaticallyChecksForUpdates=YES;controller.updater.automaticallyDownloadsUpdates=NO;}
 else updaterDelegate.feed=feed;
 return empty(env);
}
static napi_value checkUpdates(napi_env env,napi_callback_info info){if(!controller){napi_throw_error(env,NULL,"Источник обновлений ещё не подключён.");return NULL;}[controller checkForUpdates:nil];return empty(env);}
static napi_value init(napi_env env,napi_value exports){napi_property_descriptor methods[]={{"getKey",NULL,getKey,NULL,NULL,NULL,napi_default,NULL},{"setKey",NULL,setKey,NULL,NULL,NULL,napi_default,NULL},{"clearKey",NULL,clearKey,NULL,NULL,NULL,napi_default,NULL},{"startUpdates",NULL,startUpdates,NULL,NULL,NULL,napi_default,NULL},{"checkUpdates",NULL,checkUpdates,NULL,NULL,NULL,napi_default,NULL}};napi_define_properties(env,exports,sizeof(methods)/sizeof(*methods),methods);return exports;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
