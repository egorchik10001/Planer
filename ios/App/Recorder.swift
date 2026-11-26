import AVFoundation
import Foundation

@MainActor
final class Recorder {
    private var recording: AVAudioRecorder?

    func start() async throws {
        guard recording == nil else { throw PlannerError.failure("Запись уже идёт.") }
        guard await AVAudioApplication.requestRecordPermission() else {
            throw PlannerError.failure("Разреши Планеру пользоваться микрофоном в настройках iPhone.")
        }
        guard recording == nil else { throw PlannerError.failure("Запись уже идёт.") }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement)
        try session.setActive(true)
        let url = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".wav")
        do {
            let recorder = try AVAudioRecorder(url: url, settings: [
                AVFormatIDKey: Int(kAudioFormatLinearPCM),
                AVSampleRateKey: 16000,
                AVNumberOfChannelsKey: 1,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsFloatKey: false,
                AVLinearPCMIsBigEndianKey: false
            ])
            guard recorder.record(forDuration: 180) else { throw PlannerError.failure("Не удалось начать запись.") }
            recording = recorder
        } catch {
            try? FileManager.default.removeItem(at: url)
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            throw error
        }
    }

    func finish() throws -> Data {
        guard let active = recording else { throw PlannerError.failure("Запись не найдена.") }
        recording = nil
        active.stop()
        defer {
            try? FileManager.default.removeItem(at: active.url)
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
        return try Data(contentsOf: active.url)
    }

    func cancel() {
        guard recording != nil else { return }
        _ = try? finish()
    }
}
