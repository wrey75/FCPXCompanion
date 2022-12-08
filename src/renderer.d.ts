export interface IElectronAPI {
    loadPreferences: () => Promise<void>,
}

declare global {
    interface Window {
        myAPI: IElectronAPI
    }
}