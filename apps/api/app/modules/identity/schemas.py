"""HTTP schemas for administrative identity operations."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=512)


class LoginResponse(BaseModel):
    authenticated: Literal[True]
    username: str


class SessionResponse(BaseModel):
    authenticated: Literal[True]
    username: str
    organization_id: str


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=512)
    new_password: str = Field(min_length=1, max_length=512)
    confirmation: str = Field(min_length=1, max_length=512)
