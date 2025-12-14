from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

app = FastAPI(title="Scotch Bonnet Plant Monitor API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include moved routes
from routes.growth import router as growth_router
app.include_router(growth_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
