import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb-client"

// Event configurations with their collection names, details, and dates
const EVENTS = [
  {
    name: "Muthupalasa 1",
    location: "Kandalama",
    collection: "MP1_KANDALAMA",
    url: "https://muthupalasa.com/mp1-kandalama",
    eventDate: "2025-06-02", 
  },
  {
    name: "Muthupalasa 2",
    location: "Kandalama",
    collection: "MP2_KANDALAMA",
    url: "https://muthupalasa.com/mp2-kandalama",
    eventDate: "2025-06-05", 
  },
  {
    name: "Muthupalasa 3",
    location: "Kandalama",
    collection: "MP3_KANDALAMA",
    url: "https://muthupalasa.com/mp3-kandalama",
    eventDate: "2025-06-06", // Add your actual event date
  },
  {
    name: "Start Club 1",
    location: "Kandalama",
    collection: "SC1_KANDALAMA",
    url: "https://muthupalasa.com/startclub1-kandalama",
    eventDate: "2025-06-03", // Add your actual event date
  },
  {
    name: "Start Club 2",
    location: "Kandalama",
    collection: "SC2_KANDALAMA",
    url: "https://muthupalasa.com/startclub2-kandalama",
    eventDate: "2025-06-04", // Add your actual event date
  },
  {
    name: "Muthupalasa 4",
    location: "Nuwara Eliya",
    collection: "MP4_NUWARAELIYA",
    url: "https://muthupalasa.com/mp4-nuwaraeliya",
    eventDate: "2025-06-11", // Add your actual event date
  },
  {
    name: "Muthupalasa 5",
    location: "Embilipitiya",
    collection: "MP5_EMB",
    url: "https://muthupalasa.com/mp5-embilipitiya",
    eventDate: "2025-06-13", // Add your actual event date
  },
  { 
    name: "Muthupalasa 6", 
    location: "Galle", 
    collection: "MP6_GALLE", 
    url: "https://muthupalasa.com/mp6-galle",
    eventDate: "2025-06-20", // Add your actual event date
  },
  {
    name: "Start Club 3",
    location: "Galle",
    collection: "SC3_GALLE",
    url: "https://muthupalasa.com/startclub3-galle",
    eventDate: "2025-06-21", // Add your actual event date
  },
  { 
    name: "Muthupalasa 7", 
    location: "Monarch", 
    collection: "MP7_MONARCH", 
    url: "https://muthupalasa.com/mp7-monarch",
    eventDate: "2025-06-16", // Add your actual event date
  },
  { 
    name: "Muthupalasa 8", 
    location: "Monarch", 
    collection: "MP8_MONARCH", 
    url: "https://muthupalasa.com/mp8-monarch",
    eventDate: "2025-06-17", // Add your actual event date
  },
  {
    name: "Start Club 4",
    location: "Monarch",
    collection: "SC4_MONARCH",
    url: "https://muthupalasa.com/startclub4-monarch",
    eventDate: "2025-06-18", // Add your actual event date
  },
]

const KIOSK_DB = "muthupalasa_kiosk"

// Helper function to convert data to CSV format
function convertToCSV(data: any[]): string {
  if (data.length === 0) return ""
  
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(","), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Handle values that might contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value || ''
      }).join(",")
    )
  ]
  
  return csvRows.join("\n")
}

// Helper function to safely get BP field values
function getBPField(winner: any, fieldName: string): string {
  // Try multiple possible locations for the BP fields
  const possibleValues = [
    winner.eventuserdata?.[fieldName],
    winner[fieldName],
    winner.eventuserdata?.[fieldName.toLowerCase()],
    winner[fieldName.toLowerCase()],
    winner.eventuserdata?.[fieldName.replace(' ', '_')],
    winner[fieldName.replace(' ', '_')],
    winner.eventuserdata?.[fieldName.replace(' ', '')],
    winner[fieldName.replace(' ', '')],
  ]
  
  for (const value of possibleValues) {
    if (value !== undefined && value !== null && value !== '') {
      return String(value)
    }
  }
  
  return 'N/A'
}

// Helper function to get BP data for a winner
async function getBPDataForWinner(collection: any, winner: any) {
  return {
    bpCode: getBPField(winner, 'BP Code'),
    bpName: getBPField(winner, 'BP Name'),
    outletCode: getBPField(winner, 'Outlet Code')
  }
}
function formatDateForCSV(date: any): string {
  if (!date) return 'N/A'
  
  try {
    // Handle both Date objects and ISO strings
    const dateObj = date instanceof Date ? date : new Date(date)
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) return 'N/A'
    
    // Format as readable date string
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch (error) {
    return 'N/A'
  }
}

// Helper function to get event statistics
async function getEventStats(collection: any) {
  const [registrations, totalCount, winnersCount] = await Promise.all([
    collection.find({}).sort({ createdAt: -1 }).limit(100).toArray(),
    collection.countDocuments(),
    collection.countDocuments({ "eventuserdata.isWinner": true }),
  ])

  const winners = await collection.find({ "eventuserdata.isWinner": true }).toArray()

  // Enrich winners with BP data
  const winnersWithBPData = await Promise.all(
    winners.map(async (winner: any) => {
      const bpData = await getBPDataForWinner(collection, winner)
      return {
        ...winner,
        bpData
      }
    })
  )

  return {
    registrations,
    totalCount,
    winnersCount,
    winners: winnersWithBPData
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const eventCollection = url.searchParams.get("collection")
    const location = url.searchParams.get("location")
    const getAllEvents = url.searchParams.get("all") === "true"
    const winnersOnly = url.searchParams.get("winners") === "true"
    const format = url.searchParams.get("format") // 'csv' or 'json'

    const client = await clientPromise
    const db = client.db(KIOSK_DB)

    if (getAllEvents) {
      // Get data from all events
      const allEventsData = await Promise.all(
        EVENTS.map(async (event) => {
          try {
            const collection = db.collection(event.collection)
            const stats = await getEventStats(collection)

            return {
              ...event,
              ...stats,
            }
          } catch (error) {
            console.log(`Collection ${event.collection} not found or empty`)
            return {
              ...event,
              registrations: [],
              totalCount: 0,
              winnersCount: 0,
              winners: []
            }
          }
        }),
      )

      // If CSV format is requested
      if (format === 'csv') {
        if (winnersOnly) {
          // CSV for all winners across events
          const allWinners = allEventsData.flatMap(event => 
            event.winners.map((winner: any) => ({
              'Event Name': event.name,
              'Event Date': event.eventDate,
              'Location': event.location,
              'Winner Name': winner.eventuserdata?.ownerName || 'N/A',
              'NIC': winner.eventuserdata?.ownerNIC || 'N/A',
              'Shop Name': winner.eventuserdata?.shopName || 'N/A',
              'Golden Pass Number': winner.eventuserdata?.goldenPassNumber || 'N/A',
              'Classification': winner.eventuserdata?.classification || 'N/A',
              'BP Code': winner.bpData?.bpCode || 'N/A',
              'BP Name': winner.bpData?.bpName || 'N/A',
              'Outlet Code': winner.bpData?.outletCode || 'N/A',
              'Created At': formatDateForCSV(winner.createdAt),
              'Updated At': formatDateForCSV(winner.updatedAt),
              // 'Background Image': winner.eventuserdata?.backgroundMergedImage || 'N/A',
              // 'Selected Background': winner.eventuserdata?.selectedBackground || 'N/A'
            }))
          )

          const csvString = convertToCSV(allWinners)
          
          return new NextResponse(csvString, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': 'attachment; filename="all_events_winners.csv"',
            },
          })
        } else {
          // CSV for event summary
          const csvData = allEventsData.map(event => ({
            'Event Name': event.name,
            'Event Date': event.eventDate,
            'Location': event.location,
            'Collection': event.collection,
            'Total Participants': event.totalCount,
            'Winners Count': event.winnersCount,
            'URL': event.url
          }))

          const csvString = convertToCSV(csvData)
          
          return new NextResponse(csvString, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': 'attachment; filename="events_participants_summary.csv"',
            },
          })
        }
      }

      return NextResponse.json({
        success: true,
        data: allEventsData,
        summary: {
          totalEvents: EVENTS.length,
          totalRegistrations: allEventsData.reduce((sum, event) => sum + event.totalCount, 0),
          totalWinners: allEventsData.reduce((sum, event) => sum + event.winnersCount, 0),
          activeEvents: allEventsData.filter((event) => event.totalCount > 0).length,
        },
      })
    }

    if (location) {
      // Get data for specific location
      const locationEvents = EVENTS.filter((event) => event.location.toLowerCase() === location.toLowerCase())

      const locationData = await Promise.all(
        locationEvents.map(async (event) => {
          try {
            const collection = db.collection(event.collection)
            const stats = await getEventStats(collection)

            return {
              ...event,
              ...stats,
            }
          } catch (error) {
            return {
              ...event,
              registrations: [],
              totalCount: 0,
              winnersCount: 0,
              winners: []
            }
          }
        }),
      )

      // If CSV format is requested for location
      if (format === 'csv') {
        if (winnersOnly) {
          // CSV for winners in this location
          const locationWinners = locationData.flatMap(event => 
            event.winners.map((winner: any) => ({
              'Event Name': event.name,
              'Event Date': event.eventDate,
              'Location': event.location,
              'Winner Name': winner.eventuserdata?.ownerName || 'N/A',
              'NIC': winner.eventuserdata?.ownerNIC || 'N/A',
              'Shop Name': winner.eventuserdata?.shopName || 'N/A',
              'Golden Pass Number': winner.eventuserdata?.goldenPassNumber || 'N/A',
              'Classification': winner.eventuserdata?.classification || 'N/A',
              'BP Code': winner.bpData?.bpCode || 'N/A',
              'BP Name': winner.bpData?.bpName || 'N/A',
              'Outlet Code': winner.bpData?.outletCode || 'N/A',
              'Created At': formatDateForCSV(winner.createdAt),
              'Updated At': formatDateForCSV(winner.updatedAt),
              // 'Background Image': winner.eventuserdata?.backgroundMergedImage || 'N/A',
              // 'Selected Background': winner.eventuserdata?.selectedBackground || 'N/A'
            }))
          )

          const csvString = convertToCSV(locationWinners)
          
          return new NextResponse(csvString, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${location}_winners.csv"`,
            },
          })
        } else {
          const csvData = locationData.map(event => ({
            'Event Name': event.name,
            'Event Date': event.eventDate,
            'Location': event.location,
            'Collection': event.collection,
            'Total Participants': event.totalCount,
            'Winners Count': event.winnersCount,
            'URL': event.url
          }))

          const csvString = convertToCSV(csvData)
          
          return new NextResponse(csvString, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${location}_events_participants.csv"`,
            },
          })
        }
      }

      return NextResponse.json({
        success: true,
        data: locationData,
        location,
        summary: {
          totalEvents: locationEvents.length,
          totalRegistrations: locationData.reduce((sum, event) => sum + event.totalCount, 0),
          totalWinners: locationData.reduce((sum, event) => sum + event.winnersCount, 0),
        },
      })
    }

    if (eventCollection) {
      // Get data for specific event
      const event = EVENTS.find((e) => e.collection === eventCollection)
      if (!event) {
        return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 })
      }

      const collection = db.collection(eventCollection)
      const stats = await getEventStats(collection)

      // If CSV format is requested for specific event
      if (format === 'csv') {
        if (winnersOnly) {
          // CSV for winners in this event
          const eventWinners = stats.winners.map((winner: any) => ({
            'Event Name': event.name,
            'Event Date': event.eventDate,
            'Location': event.location,
            'Winner Name': winner.eventuserdata?.ownerName || 'N/A',
            'NIC': winner.eventuserdata?.ownerNIC || 'N/A',
            'Shop Name': winner.eventuserdata?.shopName || 'N/A',
            'Golden Pass Number': winner.eventuserdata?.goldenPassNumber || 'N/A',
            'Classification': winner.eventuserdata?.classification || 'N/A',
            'BP Code': winner.bpData?.bpCode || 'N/A',
            'BP Name': winner.bpData?.bpName || 'N/A',
            'Outlet Code': winner.bpData?.outletCode || 'N/A',
            'Created At': formatDateForCSV(winner.createdAt),
            'Updated At': formatDateForCSV(winner.updatedAt),
            // 'Background Image': winner.eventuserdata?.backgroundMergedImage || 'N/A',
            // 'Selected Background': winner.eventuserdata?.selectedBackground || 'N/A'
          }))

          const csvString = convertToCSV(eventWinners)
          
          return new NextResponse(csvString, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${event.name.replace(/\s+/g, '_')}_winners.csv"`,
            },
          })
        } else {
          const csvData = [{
            'Event Name': event.name,
            'Event Date': event.eventDate,
            'Location': event.location,
            'Collection': event.collection,
            'Total Participants': stats.totalCount,
            'Winners Count': stats.winnersCount,
            'URL': event.url
          }]

          const csvString = convertToCSV(csvData)
          
          return new NextResponse(csvString, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${event.name.replace(/\s+/g, '_')}_participants.csv"`,
            },
          })
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          ...event,
          ...stats,
        },
      })
    }

    // Return list of all events with basic info
    const eventsWithCounts = await Promise.all(
      EVENTS.map(async (event) => {
        try {
          const collection = db.collection(event.collection)
          const stats = await getEventStats(collection)
          return { ...event, totalCount: stats.totalCount, winnersCount: stats.winnersCount }
        } catch (error) {
          return { ...event, totalCount: 0, winnersCount: 0 }
        }
      }),
    )

    // If CSV format is requested for events summary
    if (format === 'csv') {
      const csvData = eventsWithCounts.map(event => ({
        'Event Name': event.name,
        'Event Date': event.eventDate,
        'Location': event.location,
        'Collection': event.collection,
        'Total Participants': event.totalCount,
        'Winners Count': event.winnersCount,
        'URL': event.url
      }))

      const csvString = convertToCSV(csvData)
      
      return new NextResponse(csvString, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="all_events_summary.csv"',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: eventsWithCounts,
      summary: {
        totalEvents: EVENTS.length,
        totalRegistrations: eventsWithCounts.reduce((sum, event) => sum + event.totalCount, 0),
        totalWinners: eventsWithCounts.reduce((sum, event) => sum + event.winnersCount, 0),
        activeEvents: eventsWithCounts.filter((event) => event.totalCount > 0).length,
      },
    })
  } catch (error) {
    console.error("Error fetching events data:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch events data", error: (error as Error).message },
      { status: 500 },
    )
  }
}