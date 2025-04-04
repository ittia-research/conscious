"""
Endpoints to retrieve configs, for example identifiers of sources.
"""
import logging
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel
from typing import Dict, Any

from data.sources import define_sources

logger = logging.getLogger(__name__)


router = APIRouter()


class ConfigResponse(BaseModel):
    configs: Dict[str, Any]


@router.get("/{config_type}", response_model=ConfigResponse)
async def get_configs(config_type: str = Path(..., description="To retrieve configs of which object")):
    """
    Return configs for a object.
    """
    print(config_type)
    supported = ['sources']

    if config_type not in supported:
        raise HTTPException(status_code=404, detail=f"No config found for: {config_type}")

    return ConfigResponse(configs=define_sources)
