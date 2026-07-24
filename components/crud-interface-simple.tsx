"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Trash2, Edit, Plus, Search, RefreshCw, Eye } from "lucide-react"

interface Document {
  _id: string
  [key: string]: any
}

interface CrudInterfaceProps {
  database: string
  collection: string
  title: string
  description: string
}

export function CrudInterface({ database, collection, title, description }: CrudInterfaceProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [newDocumentData, setNewDocumentData] = useState("")
  const [editDocumentData, setEditDocumentData] = useState("")

  const fetchDocuments = async (page = 1, search = "") => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        database,
        collection,
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
      })

      const response = await fetch(`/api/crud?${params}`)
      const result = await response.json()

      if (result.success) {
        setDocuments(result.data)
        setTotalPages(result.pagination.pages)
        setCurrentPage(page)
      } else {
        alert(result.message || "Failed to fetch documents")
      }
    } catch (error) {
      alert("Failed to fetch documents")
    } finally {
      setLoading(false)
    }
  }

  const createDocument = async () => {
    try {
      const data = JSON.parse(newDocumentData)
      const params = new URLSearchParams({ database, collection })

      const response = await fetch(`/api/crud?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        alert("Document created successfully")
        setIsCreateModalOpen(false)
        setNewDocumentData("")
        fetchDocuments(currentPage, searchTerm)
      } else {
        alert(result.message || "Failed to create document")
      }
    } catch (error) {
      alert("Invalid JSON format")
    }
  }

  const updateDocument = async () => {
    if (!selectedDocument) return

    try {
      const data = JSON.parse(editDocumentData)
      const params = new URLSearchParams({
        database,
        collection,
        id: selectedDocument._id,
      })

      const response = await fetch(`/api/crud?${params}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        alert("Document updated successfully")
        setIsEditModalOpen(false)
        setSelectedDocument(null)
        setEditDocumentData("")
        fetchDocuments(currentPage, searchTerm)
      } else {
        alert(result.message || "Failed to update document")
      }
    } catch (error) {
      alert("Invalid JSON format")
    }
  }

  const deleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return

    try {
      const params = new URLSearchParams({ database, collection, id })

      const response = await fetch(`/api/crud?${params}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        alert("Document deleted successfully")
        fetchDocuments(currentPage, searchTerm)
      } else {
        alert(result.message || "Failed to delete document")
      }
    } catch (error) {
      alert("Failed to delete document")
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchDocuments(1, searchTerm)
  }

  const openEditModal = (document: Document) => {
    setSelectedDocument(document)
    setEditDocumentData(JSON.stringify(document, null, 2))
    setIsEditModalOpen(true)
  }

  const openViewModal = (document: Document) => {
    setSelectedDocument(document)
    setIsViewModalOpen(true)
  }

  useEffect(() => {
    fetchDocuments()
  }, [database, collection])

  const getDisplayValue = (obj: any, path: string) => {
    return path.split(".").reduce((current, key) => current?.[key], obj) || "N/A"
  }

  const getDocumentPreview = (doc: Document) => {
    // Try to get meaningful fields based on collection type
    if (collection === "test_registrations") {
      return {
        name: getDisplayValue(doc, "dealerInfo.ownerName"),
        nic: getDisplayValue(doc, "dealerInfo.ownerNIC"),
        shop: getDisplayValue(doc, "dealerInfo.shopName"),
      }
    } else if (collection.includes("EventDaySubmission") || collection.includes("MP7")) {
      return {
        name: getDisplayValue(doc, "eventuserdata.ownerName"),
        nic: getDisplayValue(doc, "eventuserdata.ownerNIC"),
        shop: getDisplayValue(doc, "eventuserdata.shopName"),
      }
    } else if (collection === "processed-images") {
      return {
        nic: getDisplayValue(doc, "nic"),
        imageUrl: getDisplayValue(doc, "imageUrl") ? "Available" : "N/A",
        processedAt: getDisplayValue(doc, "createdAt"),
      }
    }

    // Fallback for unknown collections
    const keys = Object.keys(doc).filter((key) => key !== "_id" && typeof doc[key] === "string")
    return keys.slice(0, 3).reduce(
      (acc, key) => {
        acc[key] = doc[key]
        return acc
      },
      {} as Record<string, any>,
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <div className="flex gap-2">
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Document</DialogTitle>
                  <DialogDescription>Add a new document to {collection}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="newDocument">Document Data (JSON)</Label>
                    <Textarea
                      id="newDocument"
                      placeholder='{"field": "value"}'
                      value={newDocumentData}
                      onChange={(e) => setNewDocumentData(e.target.value)}
                      rows={10}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createDocument}>Create Document</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={() => fetchDocuments(currentPage, searchTerm)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Documents List */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No documents found</div>
          ) : (
            documents.map((doc) => {
              const preview = getDocumentPreview(doc)
              return (
                <div key={doc._id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(preview).map(([key, value]) => (
                          <Badge key={key} variant="outline">
                            {key}: {String(value).substring(0, 30)}
                            {String(value).length > 30 ? "..." : ""}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">ID: {doc._id}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => openViewModal(doc)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditModal(doc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteDocument(doc._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => fetchDocuments(currentPage - 1, searchTerm)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => fetchDocuments(currentPage + 1, searchTerm)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Document</DialogTitle>
              <DialogDescription>Modify the document data</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editDocument">Document Data (JSON)</Label>
                <Textarea
                  id="editDocument"
                  value={editDocumentData}
                  onChange={(e) => setEditDocumentData(e.target.value)}
                  rows={15}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={updateDocument}>Update Document</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Modal */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>View Document</DialogTitle>
              <DialogDescription>Document details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                {selectedDocument ? JSON.stringify(selectedDocument, null, 2) : ""}
              </pre>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
