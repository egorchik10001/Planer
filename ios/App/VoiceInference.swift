import AVFoundation
import Foundation

enum VoiceInference {
    static func transcribe(data: Data, model: URL) throws -> String {
        let wav = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".wav")
        try data.write(to: wav, options: .atomic)
        defer { try? FileManager.default.removeItem(at: wav) }
        let audio = try AVAudioFile(forReading: wav)
        guard audio.processingFormat.sampleRate == 16000,
              audio.processingFormat.channelCount == 1,
              audio.length > 0, audio.length <= 182 * 16000,
              let buffer = AVAudioPCMBuffer(pcmFormat: audio.processingFormat, frameCapacity: AVAudioFrameCount(audio.length)) else {
            throw PlannerError.failure("Запиши сообщение до трёх минут.")
        }
        try audio.read(into: buffer)
        guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else {
            throw PlannerError.failure("В записи не слышно речи.")
        }
        let frames = Int(buffer.frameLength)
        var power: Float = 0
        for i in 0..<frames { power += samples[i] * samples[i] }
        guard (power / Float(frames)).squareRoot() >= 0.001 else { throw PlannerError.failure("В записи не слышно речи.") }
        guard let result = planner_transcribe(model.path(percentEncoded: false), samples, Int32(frames), useGPU) else {
            throw PlannerError.failure("Не удалось распознать речь. Запись сохранена.")
        }
        defer { planner_voice_release(result) }
        return String(cString: result).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func interpret(prompt: String, model: URL) throws -> String {
        guard prompt.utf8.count < 160_000 else {
            throw PlannerError.failure("Сообщение слишком длинное. Попробуй разбить его на несколько.")
        }
        guard let result = planner_interpret(model.path(percentEncoded: false), prompt, useGPU) else {
            throw PlannerError.failure("Модель не закончила разбор. Попробуй более короткое сообщение.")
        }
        defer { planner_voice_release(result) }
        return String(cString: result)
    }

    private static var useGPU: Bool {
        #if targetEnvironment(simulator)
        false
        #else
        true
        #endif
    }
}
