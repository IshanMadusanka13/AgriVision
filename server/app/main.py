from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
#from configs.database import Base, engine
from routes.upload_router import router as upload_router

app = FastAPI()

# Troubleshooting: allow all origins so CORS headers are always present.
# Change back to a strict list like ["http://localhost:8081"] when verified.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # <-- changed: allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Base.metadata.create_all(bind=engine)

# Add a small exception handler to clarify multipart parsing errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "detail": "Invalid request. Possible missing multipart boundary or malformed form-data. Ensure the client sends FormData and does NOT set the Content-Type header manually.",
            "errors": str(exc)
        },
    )


@app.get("/")
async def root():
    return {"message": "Hello World"}

app.include_router(upload_router, prefix="/upload", tags=["Upload"])