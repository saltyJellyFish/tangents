import { useState } from 'react'
import { connectGoogleCalendar,getCalendarEvents } from './services/googleCalendar'
import './App.css'

function App() {
    const [accessToken, setAccessToken] = useState(null)
    const [events, setEvents] = useState([])
    const [error, setError] = useState('')

    async function handleConnect() {
        setError('')

        try {
            const token = await connectGoogleCalendar()
            setAccessToken(token)
            const upcomingEvents = await getCalendarEvents(token)
            setEvents(upcomingEvents)
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
                {accessToken ? (
                    <ul>
                        {events.map((event) => (
                            <li key={event.id}>
                                {event.summary || 'Untitled event'}
                                {' — '}
                                {new Date(event.start.dateTime || event.start.date).toLocaleString()}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Connect your Google account to view your calendar.</p>
                )}
            </section>
        </main>
    )
}

export default App