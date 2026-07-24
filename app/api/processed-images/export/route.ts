import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb-client"
import puppeteer from 'puppeteer'
import outletData from '@/public/mpdata.json'

const PROCESSED_IMAGES_DB = "background-removal"
const PROCESSED_IMAGES_COLLECTION = "processed-images"

// Interface for processed image data
interface ProcessedImage {
  _id: string
  nic: string
  dealerName: string
  area: string
  classification: string
  imageUrl: string
  originalImageUrl: string
  cloudinaryPublicId: string
  processedAt: string
  isU2NetProcessed: boolean
}

interface EnhancedProcessedImage extends ProcessedImage {
  bpCode: string
  outletCode: string
  contactNo: string
  shopName: string
  processedDate: string
  processedTime: string
}

// Create mappings for outlet data
class ProcessedImageMappingService {
  private nicToBPCodeMap = new Map<string, string>()
  private nicToOutletCodeMap = new Map<string, string>()
  private nicToContactMap = new Map<string, string>()
  private nicToShopNameMap = new Map<string, string>()

  constructor() {
    this.initializeMappings()
  }

  private initializeMappings() {
    try {
      const dealers = (outletData as any).dealers || []
      
      dealers.forEach((outlet: any) => {
        if (outlet.NICNUMBER) {
          const nicString = String(outlet.NICNUMBER).toUpperCase().trim()
          this.nicToBPCodeMap.set(nicString, outlet["BP CODE"] || "N/A")
          this.nicToOutletCodeMap.set(nicString, outlet["OUTLET CODE"] || outlet["CODE"] || "N/A")
          this.nicToContactMap.set(nicString, outlet["CONTACTNO"] || "N/A")
          this.nicToShopNameMap.set(nicString, outlet["OUTLET NAME"] || outlet["SHOP NAME"] || "N/A")
        }
      })

      console.log(`Initialized processed image mappings: ${this.nicToBPCodeMap.size} NIC entries`)
    } catch (error) {
      console.error('Error initializing processed image mappings:', error)
    }
  }

  public enhanceProcessedImage(image: ProcessedImage): EnhancedProcessedImage {
    const nicString = String(image.nic || '').toUpperCase().trim()
    
    // Parse processedAt date
    const processedDate = new Date(image.processedAt)
    const processedDateStr = processedDate.toLocaleDateString()
    const processedTimeStr = processedDate.toLocaleTimeString()

    return {
      ...image,
      bpCode: this.nicToBPCodeMap.get(nicString) || "N/A",
      outletCode: this.nicToOutletCodeMap.get(nicString) || "N/A",
      contactNo: this.nicToContactMap.get(nicString) || "N/A", 
      shopName: this.nicToShopNameMap.get(nicString) || "N/A",
      processedDate: processedDateStr,
      processedTime: processedTimeStr
    }
  }
}

const mappingService = new ProcessedImageMappingService()

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const format = url.searchParams.get("format") || "summary"
    const search = url.searchParams.get("search")

    // Validate format
    if (!['summary', 'detailed', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, message: "Invalid format. Use 'summary', 'detailed', or 'pdf'" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db(PROCESSED_IMAGES_DB)
    const collection = db.collection(PROCESSED_IMAGES_COLLECTION)

    // Build search query
    let query = {}
    if (search) {
      const searchRegex = { $regex: search, $options: "i" }
      query = {
        $or: [
          { nic: searchRegex },
          { dealerName: searchRegex },
          { area: searchRegex },
          { classification: searchRegex },
        ],
      }
    }

    // Get all processed images
    const [processedImages, totalCount] = await Promise.all([
      collection.find(query).sort({ processedAt: -1 }).toArray(),
      collection.countDocuments(query),
    ])

    // Enhance with mapping data
    const enhancedImages = processedImages.map(img => 
      mappingService.enhanceProcessedImage(img as unknown as ProcessedImage)
    )

    // Generate response based on format
    switch (format) {
      case 'summary':
        return generateSummaryCSV(enhancedImages)
      case 'detailed':
        return generateDetailedCSV(enhancedImages)
      case 'pdf':
        return await generatePDFReport(enhancedImages, totalCount, search)
      default:
        return NextResponse.json({ success: false, message: "Invalid format" }, { status: 400 })
    }

  } catch (error) {
    console.error("Error generating processed images export:", error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to generate export", 
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

function generateSummaryCSV(images: EnhancedProcessedImage[]): NextResponse {
  const csvHeaders = [
    "Date",
    "NIC",
    "Name"
  ]

  const csvRows = images.map(img => [
    img.processedDate,
    img.nic || "N/A",
    img.dealerName || "N/A"
  ])

  const csvContent = [csvHeaders, ...csvRows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="processed-images-summary-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}

function generateDetailedCSV(images: EnhancedProcessedImage[]): NextResponse {
  const csvHeaders = [
    "Date",
    // "Time", 
    "NIC",
    "Dealer Name",
    "Shop Name",
    "Contact No",
    "Area",
    "Classification",
    "BP Code",
    "Outlet Code",
    // "Image URL",
    // "Original Image URL",
    // "Cloudinary Public ID",
    // "U2Net Processed",
    // "Processed At (ISO)"
  ]

  const csvRows = images.map(img => [
    img.processedDate,
    // img.processedTime,
    img.nic || "N/A",
    img.dealerName || "N/A",
    img.shopName,
    img.contactNo,
    img.area || "N/A",
    img.classification || "N/A",
    img.bpCode,
    img.outletCode,
    // img.imageUrl || "N/A",
    // img.originalImageUrl || "N/A",
    // img.cloudinaryPublicId || "N/A",
    // img.isU2NetProcessed ? "Yes" : "No",
    // img.processedAt
  ])

  const csvContent = [csvHeaders, ...csvRows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="processed-images-detailed-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}

async function generatePDFReport(
  images: EnhancedProcessedImage[], 
  totalCount: number, 
  search?: string | null
): Promise<NextResponse> {
  const htmlContent = generatePDFHTML(images, totalCount, search)
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  })
  
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 800 })
    
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    })
    
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="processed-images-report-${new Date().toISOString().split("T")[0]}.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
    
  } finally {
    await browser.close()
  }
}

function generatePDFHTML(images: EnhancedProcessedImage[], totalCount: number, search?: string | null): string {
  // Calculate statistics
  const areaStats = images.reduce((acc, img) => {
    const area = img.area || "Unspecified"
    acc[area] = (acc[area] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const classificationStats = images.reduce((acc, img) => {
    const classification = img.classification || "Unspecified"
    acc[classification] = (acc[classification] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const u2netCount = images.filter(img => img.isU2NetProcessed).length
  const bpCodeMatchCount = images.filter(img => img.bpCode !== "N/A").length
  const outletCodeMatchCount = images.filter(img => img.outletCode !== "N/A").length

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Processed Images Report</title>
      <style>
        @page {
          margin: 0.5in;
          size: A4;
        }
        
        body { 
          font-family: 'Arial', sans-serif; 
          margin: 0;
          padding: 0;
          line-height: 1.4;
          color: #333;
          font-size: 12px;
        }
        
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
        }
        
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
          font-weight: 700;
        }
        
        .stats-grid { 
          display: grid; 
          grid-template-columns: repeat(4, 1fr);
          gap: 15px; 
          margin: 20px 0; 
        }
        
        .stat-card { 
          text-align: center; 
          padding: 15px; 
          border: 2px solid #e5e7eb; 
          border-radius: 8px; 
          background: #f8fafc;
        }
        
        .stat-card h3 {
          margin: 0 0 5px 0;
          font-size: 18px;
          color: #1e40af;
          font-weight: 700;
        }
        
        .stat-card p {
          margin: 0;
          color: #64748b;
          font-size: 11px;
        }
        
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0; 
          font-size: 8px;
        }
        
        th, td { 
          border: 1px solid #e2e8f0; 
          padding: 3px 2px; 
          text-align: left; 
          word-wrap: break-word;
        }
        
        th { 
          background: #3b82f6;
          color: white;
          font-weight: 600;
          font-size: 7px;
        }
        
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        
        .processed-badge {
          background: #10b981;
          color: white;
          padding: 2px 4px;
          border-radius: 3px;
          font-weight: 600;
          font-size: 6px;
        }
        
        .not-processed-badge {
          background: #ef4444;
          color: white;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 6px;
        }
        
        .bp-code {
          background: #10b981;
          color: white;
          padding: 1px 3px;
          border-radius: 2px;
          font-weight: 600;
          font-size: 6px;
        }
        
        .outlet-code {
          background: #8b5cf6;
          color: white;
          padding: 1px 3px;
          border-radius: 2px;
          font-weight: 600;
          font-size: 6px;
        }
        
        .footer { 
          margin-top: 30px; 
          text-align: center; 
          font-size: 10px; 
          color: #64748b; 
          border-top: 2px solid #e2e8f0;
          padding-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🖼️ Processed Images Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        ${search ? `<p><strong>Filter:</strong> "${search}"</p>` : ""}
        <p><strong>Total Images:</strong> ${totalCount.toLocaleString()}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <h3>${totalCount.toLocaleString()}</h3>
          <p>Total Images</p>
        </div>
        <div class="stat-card">
          <h3>${u2netCount.toLocaleString()}</h3>
          <p>U2Net Processed</p>
        </div>
        <div class="stat-card">
          <h3>${bpCodeMatchCount.toLocaleString()}</h3>
          <p>BP Code Matches</p>
        </div>
        <div class="stat-card">
          <h3>${outletCodeMatchCount.toLocaleString()}</h3>
          <p>Outlet Code Matches</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 8%">Date</th>
            <th style="width: 8%">Time</th>
            <th style="width: 10%">NIC</th>
            <th style="width: 12%">Name</th>
            <th style="width: 10%">Area</th>
            <th style="width: 8%">Classification</th>
            <th style="width: 6%">BP Code</th>
            <th style="width: 6%">Outlet Code</th>
            <th style="width: 8%">Contact</th>
            <th style="width: 6%">U2Net</th>
            <th style="width: 18%">Public ID</th>
          </tr>
        </thead>
        <tbody>
          ${images
            .map((img, index) => `
            <tr>
              <td>${img.processedDate}</td>
              <td>${img.processedTime}</td>
              <td><strong>${img.nic || "N/A"}</strong></td>
              <td>${img.dealerName || "N/A"}</td>
              <td>${img.area || "N/A"}</td>
              <td>${img.classification || "N/A"}</td>
              <td>${
                img.bpCode !== "N/A"
                  ? `<span class="bp-code">${img.bpCode}</span>`
                  : "N/A"
              }</td>
              <td>${
                img.outletCode !== "N/A"
                  ? `<span class="outlet-code">${img.outletCode}</span>`
                  : "N/A"
              }</td>
              <td>${img.contactNo !== "N/A" ? img.contactNo : "N/A"}</td>
              <td>${
                img.isU2NetProcessed
                  ? `<span class="processed-badge">Yes</span>`
                  : `<span class="not-processed-badge">No</span>`
              }</td>
              <td>${img.cloudinaryPublicId || "N/A"}</td>
            </tr>
          `)
            .join("")}
        </tbody>
      </table>

      <div class="footer">
        <p><strong>Processed Images Report - Background Removal System</strong></p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      </div>
    </body>
    </html>
  `
}