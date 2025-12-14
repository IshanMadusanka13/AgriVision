from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from routes.upload_router import router as upload_router
from routes.growth import router as growth_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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
app.include_router(growth_router)