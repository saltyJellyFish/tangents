import { useState } from 'react'
import { connectGoogleCalendar,getCalendarEvents } from './services/googleCalendar'
import './App.css'
import CalendarView from './components/CalendarView'

function App() {
    const [accessToken, setAccessToken] = useState(null)
    const [events, setEvents] = useState([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleConnect() {
        setError('')
        setLoading(true)

        try {
            const token = await connectGoogleCalendar()
            const upcomingEvents = await getCalendarEvents(token)

            setEvents(upcomingEvents)
            setAccessToken(token)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="app">
            <header className="calendar-header">
                <h1>Calendar</h1>
                <button
                    type="button"
                    onClick={handleConnect}
                    disabled={loading || !!accessToken}
                >
                    {loading
                        ? 'Connecting...'
                        : accessToken
                            ? 'Connected to Google'
                            : 'Connect Google Calendar'}
                    {accessToken ? 'Connected to Google' : 'Connect Google Calendar'}
                </button>
            </header>

            <section className="calendar-content">

                {error && <p role="alert">{error}</p>}
                {loading ? (
                    <p>Loading your calendar...</p>
                ) : accessToken ? (
                    <CalendarView events={events} />
                ) : (
                    <p>Connect your Google account to view your calendar.</p>
                )}
            </section>

        </main>
    )
}

export default App