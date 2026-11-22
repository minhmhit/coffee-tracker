from fastapi import FastAPI

app = FastAPI(
    title="Coffee Tracker ML Service",
    description="Stateless ML compute engine for coffee price forecasting",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    return {"status": "ok"}
