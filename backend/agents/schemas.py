"""Pydantic response schemas for structured Gemini agent outputs."""

from pydantic import BaseModel, Field


class SectionScore(BaseModel):
    score: int = Field(ge=0, le=100)
    feedback: str
    recommendations: list[str]


class ProfileSections(BaseModel):
    headline: SectionScore
    about: SectionScore
    experience: SectionScore
    skills: SectionScore
    education: SectionScore
    profile_photo: SectionScore
    certifications: SectionScore
    recommendations: SectionScore
    activity: SectionScore


class AnalyzeResult(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    summary: str
    sections: ProfileSections
    top_strengths: list[str]
    top_improvements: list[str]


class ExperienceEntry(BaseModel):
    title: str
    company: str
    duration: str
    description: str


class EducationEntry(BaseModel):
    school: str
    degree: str
    year: str


class ExtractProfileResult(BaseModel):
    name: str
    headline: str
    location: str
    about: str
    experience: list[ExperienceEntry]
    skills: list[str]
    education: list[EducationEntry]
    certifications: list[str]
    recommendations_count: int
    activity_summary: str
    connection_count: str


class ContentPost(BaseModel):
    post_number: int
    type: str
    title: str
    body: str
    hashtags: list[str]
    suggested_post_day: str
    suggested_post_time: str
    character_count: int = 0


class ContentPlanResult(BaseModel):
    plan_generated_at: str = ""
    source_data: list[str] = Field(default_factory=lambda: ["linkedin"])
    posts: list[ContentPost]
