from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId
from core.mongo import db
from starlette.responses import StreamingResponse
import io

router = APIRouter(prefix="/certificate", tags=["certificate"])

@router.get("/{study_id}")
async def get_certificate(study_id: str):
    """
    Retrieve or generate a certificate for a completed study.
    Returns certificate data: student_name, course_title, completion_date, etc.
    """
    try:
        # Fetch study/interview session to get student name and course info
        session = db["interview_sessions"].find_one({"_id": ObjectId(study_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Study session not found")

        userId = session.get("user_id")
        
        # Check if all assignments are passed (best-effort check)
        result = db["assignments"].find_one({"study_id": study_id})
        if not result:
            raise HTTPException(status_code=404, detail="Assignment not found")
        test = result.get("subject_level_assignment")
        if test['status'] != "completed":
            raise HTTPException(status_code=400, detail="Certificate can only be generated after completing all assignments")
        
        if test['overall_score'] < 70:
            raise HTTPException(status_code=400, detail="Certificate can only be generated after passing the capstone assignment")
        
        student = db["users"].find_one({"_id": ObjectId(userId)})
        student_name = student.get("name") if student else "Student"
        course_title = session.get("subject") or session.get("topic") or "Course"
        completion_date = result.get("completed_at", datetime.now()).isoformat()
        
        # Store certificate in DB (optional, for audit trail)
        cert_doc = {
            "study_id": study_id,
            "student_name": student_name,
            "course_title": course_title,
            "completion_date": completion_date,
            "created_at": datetime.now(),
        }
        certificate_exist = db["certificates"].find_one({"study_id": study_id})
        if not certificate_exist:
            result = db["certificates"].insert_one(cert_doc)
            certificate_id = str(result.inserted_id)

        else:
            certificate_id = str(certificate_exist["_id"])
        
        return {
            "study_id": study_id,
            "student_name": student_name,
            "course_title": course_title,
            "completion_date": completion_date,
            "certificate_id": certificate_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{study_id}/download")
async def download_certificate(study_id: str):
    """
    Generate a downloadable PDF certificate in the styled format.
    Returns the PDF as a file download.
    """
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.colors import HexColor

        # Fetch certificate data
        cert = db["certificates"].find_one({"study_id": study_id})
        if not cert:
            raise HTTPException(status_code=404, detail="Certificate not found")

        student_name = cert.get("student_name", "Student")
        course_title = cert.get("course_title", "Course")
        completion_date_raw = cert.get("completion_date", "")
        # e.g. "October 16, 2025"
        completion_date = (
            datetime.fromisoformat(completion_date_raw).strftime("%B %d, %Y")
            if completion_date_raw
            else datetime.now().strftime("%B %d, %Y")
        )

        # Create PDF in memory
        pdf_buffer = io.BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        width, height = letter

        try:
            c.drawImage(
                "static/certificate_template.png",
                0,
                0,
                width=width,
                height=height,
                preserveAspectRatio=True,
                mask="auto",
            )
        except Exception:
            # If no template image yet, just continue with white background
            pass

        # Certificate ID – top-right
        c.setFont("Helvetica", 9)
        c.drawRightString(width * 0.95, height * 0.70, f"Certificate ID: {cert.get('_id', '')}")

        # Title: "Certificate of Completion"
        c.setFont("Helvetica-Bold", 26)
        c.setFillColor(HexColor("#111827"))
        c.drawCentredString(width / 2, height * 0.61, "Certificate of Completion")

        # Subtext: "This certificate is proudly presented to"
        c.setFont("Helvetica", 14)
        c.setFillColor(HexColor("#6b7280"))
        c.drawCentredString(width / 2, height * 0.57, "This certificate is proudly presented to")

        # Student name – big, blue
        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(HexColor("#2563eb"))
        c.drawCentredString(width / 2, height * 0.5, student_name)

        # Subtext: "for successfully completing the course"
        c.setFont("Helvetica", 14)
        c.setFillColor(HexColor("#6b7280"))
        c.drawCentredString(width / 2, height * 0.45, "for successfully completing the course")

        # Course title – bold
        c.setFont("Helvetica-Bold", 18)
        c.setFillColor(HexColor("#111827"))
        c.drawCentredString(width / 2, height * 0.41, course_title)

        # Issued on – bottom-left-ish
        c.setFont("Helvetica", 9)
        c.setFillColor(HexColor("#9ca3af"))
        c.drawString(width * 0.15, height * 0.37, "Issued on")
        c.line(width * 0.15, height * 0.36, width * 0.22, height * 0.36)

        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(HexColor("#111827"))
        c.drawString(width * 0.15, height * 0.34, completion_date or datetime.now().strftime("%B %d, %Y"))
        
        # Logo – bottom-right
        try:
            c.drawImage(
                "static/logo.png",
                width * 0.76,
                height * 0.32,
                width=60,
                height=60,
                mask="auto",
            )
        except Exception:
            pass

        c.showPage()
        c.save()
        pdf_buffer.seek(0)

        # StreamingResponse for download
        filename = f"certificate_{study_id}.pdf"
        headers = {"Content-Disposition": f"attachment; filename={filename}"}

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers=headers,
        )

    except ImportError:
        raise HTTPException(
            status_code=400,
            detail="PDF generation library not available. Install reportlab: pip install reportlab",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
