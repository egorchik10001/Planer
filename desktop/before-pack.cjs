module.exports=async context=>{const {buildLocalEngines}=await import('./build-local-engines.mjs');await buildLocalEngines(context.arch===1?'x64':'arm64');};
