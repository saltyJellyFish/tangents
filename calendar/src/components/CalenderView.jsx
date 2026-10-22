
import EventCard from './EventCard'

function CalendarView({ events }) {
    if (events.length === 0) {
        return <p>No upcoming events.</p>
    }

    return (
        <div className="event-list">
            {events.map((event) => (
                <EventCard key={event.id} event={event} />
            ))}
        </div>
    )
}

export default CalendarView
