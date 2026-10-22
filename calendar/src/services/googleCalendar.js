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

export async function getCalendarEvents(accessToken) {
    const params = new URLSearchParams({
        timeMin: new Date().toISOString(),
        maxResults: '10',
        singleEvents: 'true',
        orderBy: 'startTime',
    })

    const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    )

    if (!response.ok) {
        throw new Error(`Failed to load events (${response.status})`)
    }

    const data = await response.json()
    return data.items ?? []
}
