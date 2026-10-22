const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'

export function connectGoogleCalendar() {
    return new Promise((resolve, reject) => {
        if (!CLIENT_ID) {
            reject(new Error('Missing Google Client ID'))
            return
        }

        if (!window.google?.accounts?.oauth2) {
            reject(new Error('Google authentication library has not loaded'))
            return
        }

        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE,
            callback: (response) => {
                if (response.error) {
                    reject(new Error(response.error))
                    return
                }

                resolve(response.access_token)
            },
            error_callback: (error) => {
                reject(new Error(error.type || 'Google authorization failed'))
            },
        })

        client.requestAccessToken()
    })
}