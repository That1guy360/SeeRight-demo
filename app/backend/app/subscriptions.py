from fastapi import APIRouter

router = APIRouter(prefix="/subscriptions")

@router.post("/checkout")
def checkout():
    return {"status": "ok"}
