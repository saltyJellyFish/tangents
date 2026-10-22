import './App.css'

function App() {
    return (
        <main className="app">
            <header className="calendar-header">
                <h1>Calendar</h1>
                <button type="button">Connect Google Calendar</button>
            </header>

            <section className="calendar-content">
                <p>Your calendar will appear here.</p>
            </section>
        </main>
    )
}

export default App