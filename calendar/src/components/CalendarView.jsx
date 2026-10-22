
import EventCard from './EventCard'

function CalendarView({ events }) {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()

    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]

    return (
        <div className="calendar">
            <h2>
                {today.toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                })}
            </h2>

            <div className="month-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="weekday">{day}</div>
                ))}

                {days.map((day, index) => {
                    const dayEvents = day
                        ? events.filter((event) => {
                            const start = event.start.dateTime
                                ? new Date(event.start.dateTime)
                                : new Date(`${event.start.date}T00:00:00`)

                            return start.getFullYear() === year &&
                                start.getMonth() === month &&
                                start.getDate() === day
                        })
                        : []

                    return (
                        <div key={index} className="calendar-day">
                            {day && (
                                <>
                                    <span className={
                                        day === today.getDate() ? 'today' : ''
                                    }>
                                        {day}
                                    </span>

                                    {dayEvents.map((event) => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default CalendarView
