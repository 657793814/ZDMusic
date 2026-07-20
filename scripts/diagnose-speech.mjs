// Run in browser console to diagnose Speech Recognition availability
(function() {
  const result = {};
  
  // 1. Check if API exists
  result.hasSpeechRecognition = typeof (window as any).SpeechRecognition !== 'undefined';
  result.hasWebkitSpeechRecognition = typeof (window as any).webkitSpeechRecognition !== 'undefined';
  
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  result.SR_type = typeof SR;
  
  if (!SR) {
    console.log('Speech Recognition not available');
    return;
  }
  
  // 2. Try new SR()
  try {
    const instance = new SR();
    result.newWorks = true;
    result.instanceType = typeof instance;
    result.hasStart = typeof instance.start === 'function';
    instance.abort?.();
  } catch (e: any) {
    result.newWorks = false;
    result.newError = e.message;
  }
  
  // 3. Try SR() without new
  try {
    const instance = SR();
    result.callWorks = true;
    result.instanceType = typeof instance;
    result.hasStart = typeof instance.start === 'function';
    instance.abort?.();
  } catch (e: any) {
    result.callWorks = false;
    result.callError = e.message;
  }
  
  // 4. Try Function constructor hack
  try {
    const DynamicNew = new Function('ctor', 'return new ctor()');
    const instance = DynamicNew(SR);
    result.functionNewWorks = true;
    result.instanceType = typeof instance;
    result.hasStart = typeof instance.start === 'function';
    instance.abort?.();
  } catch (e: any) {
    result.functionNewWorks = false;
    result.functionNewError = e.message;
  }
  
  console.log('Speech Recognition diagnostic:', JSON.stringify(result, null, 2));
})();
