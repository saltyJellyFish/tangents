import { useState } from 'react'
import { connectGoogleCalendar } from './services/googleCalendar'
import './App.css'

function App() {
    const [accessToken, setAccessToken] = useState(null)
    const [error, setError] = useState('')

    async function handleConnect() {
        setError('')

        try {
            const token = await connectGoogleCalendar()
            setAccessToken(token)
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <main className="app">
            <header className="calendar-header">
                <h1>Calendar</h1>
                <button
                    type="button"
                    onClick={handleConnect}
                    disabled={!!accessToken}
                >
                    {accessToken ? 'Connected to Google' : 'Connect Google Calendar'}
                </button>
            </header>

            <section className="calendar-content">
                {error && <p role="alert">{error}</p>}
                <p>
                    {accessToken
                        ? 'Google Calendar connected. Ready to load events.'
                        : 'Connect your Google account to view your calendar.'}
                </p>
            </section>
        </main>
    )
}

export default App