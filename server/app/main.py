from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


from app.routes.disease_router import router as upload_router
from app.routes.growth_router import router as growth_router
from app.routes.planting.planting_router import router as planting_router
from app.routes.planting.field_management_router import router as field_management_router
from app.routes.planting.layout_generator_router import router as layout_generator_router


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

app.include_router(upload_router, prefix="/api/disease", tags=["Disease"])
app.include_router(growth_router, prefix="/api/growth", tags=["Growth"])
# Include NEW planting router
app.include_router(planting_router, prefix="/api/planting", tags=["Precision Planting"])
app.include_router(field_management_router, prefix="/api/planting", tags=["Field Management"])
app.include_router(layout_generator_router, prefix="/api/planting", tags=["Layout Generation"])