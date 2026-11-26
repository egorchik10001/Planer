export type IOSBridge = {
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  cancelRecording(): Promise<void>;
  voiceReady(): Promise<boolean>;
  openVoiceSettings(): Promise<void>;
  transcribe(file: Blob): Promise<string>;
  generate(prompt: string): Promise<string>;
  shareFile(name: string, file: Blob): Promise<void>;
};

declare global {
  interface Window {
    plannerIOS?: IOSBridge;
  }
}

export async function sharePlannerFile(name: string, file: Blob) {
  if (window.plannerIOS) {
    await window.plannerIOS.shareFile(name, file);
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
