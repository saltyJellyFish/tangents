
function EventCard({ event }) {
    const allDay = !event.start.dateTime

    const date = allDay
        ? new Date(`${event.start.date}T00:00:00`)
        : new Date(event.start.dateTime)

    return (
        <article className="event-card">
            <h3>{event.summary || 'Untitled event'}</h3>
            <p>
                {date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                })}
                {' · '}
                {allDay
                    ? 'All day'
                    : date.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                    })}
            </p>
        </article>
    )
}

export default EventCard
