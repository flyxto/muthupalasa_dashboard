"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CrudInterface } from "@/components/crud-interface-table"
import { Database, Users, ImageIcon, FileText, Download, Calendar, TableIcon } from "lucide-react"

export default function CrudPage() {
  const collectionName = process.env.NEXT_PUBLIC_COLLECTION_NAME || "EventDaySubmission"

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Database Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Complete CRUD operations for all MongoDB collections
          </p>
        </div>
        
        <Button asChild variant="outline" className="shrink-0">
          <a href="/dashboard" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Dashboard</span>
          </a>
        </Button>
      </div>
      <Tabs defaultValue="kiosk-submissions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="kiosk-submissions" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Kiosk Submissions
          </TabsTrigger>
          <TabsTrigger value="processed-images" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Processed Images
          </TabsTrigger>
          <TabsTrigger value="test-registrations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Registrations
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Custom Query
          </TabsTrigger>
        </TabsList>

        <TabsContent value="test-registrations">
          <CrudInterface
            database="event_registration"
            collection="registrations"
            title="Registrations"
            description="Manage user registrations from the test event registration database"
          />
        </TabsContent>

        <TabsContent value="kiosk-submissions">
          <CrudInterface
            database="muthupalasa_kiosk"
            collection={collectionName}
            title={`Kiosk Submissions (${collectionName})`}
            description="Manage event day submissions from the kiosk application"
          />
        </TabsContent>

        <TabsContent value="processed-images">
          <div className="space-y-4">
            {/* Export Options Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export Options
                </CardTitle>
                <CardDescription>
                  Download processed images data in different formats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={() => handleExport('summary')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Summary CSV (Date, NIC, Name)
                  </Button>
                  <Button 
                    onClick={() => handleExport('detailed')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <TableIcon className="h-4 w-4" />
                    Detailed CSV (All Data with Mapping)
                  </Button>
                  <Button 
                    onClick={() => handleExport('pdf')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    PDF Report
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CRUD Interface */}
            <CrudInterface
              database="background-removal"
              collection="processed-images"
              title="Processed Images"
              description="Manage processed images with background removal"
            />
          </div>
        </TabsContent>

        <TabsContent value="custom">
          <CustomQueryInterface />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Export handler function
const handleExport = async (format: 'summary' | 'detailed' | 'pdf') => {
  try {
    const response = await fetch(`/api/processed-images/export?format=${format}`)
    
    if (!response.ok) {
      throw new Error('Export failed')
    }

    // Get filename from response headers or create default
    const contentDisposition = response.headers.get('content-disposition')
    const filename = contentDisposition 
      ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
      : `processed-images-${format}-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'csv'}`

    // Create blob and download
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

  } catch (error) {
    console.error('Export error:', error)
    alert('Export failed. Please try again.')
  }
}

function CustomQueryInterface() {
  const [database, setDatabase] = useState("")
  const [collection, setCollection] = useState("")
  const [showInterface, setShowInterface] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (database && collection) {
      setShowInterface(true)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Custom Collection Access</CardTitle>
          <CardDescription>Access any database and collection for CRUD operations</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="database" className="block text-sm font-medium mb-2">
                  Database Name
                </label>
                <input
                  id="database"
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="Enter database name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label htmlFor="collection" className="block text-sm font-medium mb-2">
                  Collection Name
                </label>
                <input
                  id="collection"
                  type="text"
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                  placeholder="Enter collection name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Access Collection
            </button>
          </form>
        </CardContent>
      </Card>

      {showInterface && (
        <CrudInterface
          database={database}
          collection={collection}
          title={`${database}.${collection}`}
          description={`Custom access to ${database} database, ${collection} collection`}
        />
      )}
    </div>
  )
}