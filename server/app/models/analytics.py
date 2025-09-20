from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class OverviewMetrics(BaseModel):
    """Overview metrics for the analytics dashboard"""
    total_candidates: int = Field(description="Total unique candidates processed")
    total_active_jobs: int = Field(description="Number of active job postings")
    total_comparisons: int = Field(description="Total comparisons performed")
    recent_comparisons: int = Field(description="Recent comparisons (last 30 days)")
    average_ats_score: float = Field(description="Average ATS score across all comparisons")
    processing_success_rate: float = Field(description="Percentage of successful processing")
    top_performing_score: float = Field(description="Highest ATS score achieved")

class ScoreDistributionRange(BaseModel):
    """Score distribution data for a specific range"""
    range: str = Field(description="Score range (e.g., '61-80')")
    count: int = Field(description="Number of candidates in this range")
    percentage: float = Field(description="Percentage of total candidates")

class ScoreStatistics(BaseModel):
    """Statistical summary of scores"""
    mean: float = Field(description="Mean score")
    median: float = Field(description="Median score")
    min: float = Field(description="Minimum score")
    max: float = Field(description="Maximum score")
    total_candidates: int = Field(description="Total number of candidates")

class ScoreDistribution(BaseModel):
    """Complete score distribution analysis"""
    distribution: List[ScoreDistributionRange] = Field(description="Score distribution by ranges")
    average_score: float = Field(description="Average score")
    median_score: float = Field(description="Median score")
    total_candidates: int = Field(description="Total number of candidates")
    score_trends: Dict[str, int] = Field(description="Score trend analysis")

class SkillDemand(BaseModel):
    """Skill demand analysis from job postings"""
    skill: str = Field(description="Skill name")
    demand: float = Field(description="Demand score (higher = more demanded)")
    jobs_count: int = Field(description="Number of jobs requiring this skill")

class CandidateSkill(BaseModel):
    """Skill availability analysis from candidates"""
    skill: str = Field(description="Skill name")
    candidates: int = Field(description="Number of candidates with this skill")
    avg_score: float = Field(description="Average ATS score for candidates with this skill")

class SkillGap(BaseModel):
    """Skills that are in demand but not available in candidate pool"""
    skill: str = Field(description="Skill name")
    gap_severity: float = Field(description="Severity of the gap (higher = more critical)")

class SkillsSummary(BaseModel):
    """Summary of skills analysis"""
    total_unique_skills_demanded: int = Field(description="Total unique skills demanded by jobs")
    total_unique_skills_available: int = Field(description="Total unique skills available in candidates")
    skill_coverage_rate: float = Field(description="Percentage of demanded skills available in candidate pool")
    high_demand_low_supply: int = Field(description="Number of skills with high demand but low supply")

class TopDemandedSkill(BaseModel):
    """Top demanded skill with detailed metrics"""
    skill: str = Field(description="Skill name")
    demand: float = Field(description="Demand score")
    jobs_count: int = Field(description="Number of jobs requiring this skill")
    candidates_count: int = Field(description="Number of candidates with this skill")
    gap_score: float = Field(description="Gap between demand and supply")

class SkillGapDetail(BaseModel):
    """Detailed skill gap information"""
    skill: str = Field(description="Skill name")
    demand: float = Field(description="Demand score")
    supply: int = Field(description="Number of candidates with this skill")
    gap_percentage: float = Field(description="Gap as percentage")
    priority: str = Field(description="Priority level")

class EmergingSkill(BaseModel):
    """Emerging skill with growth metrics"""
    skill: str = Field(description="Skill name")
    growth_rate: float = Field(description="Growth rate")
    recent_mentions: int = Field(description="Recent mentions count")

class SkillsAnalytics(BaseModel):
    """Complete skills analytics"""
    top_demanded_skills: List[TopDemandedSkill] = Field(description="Most demanded skills")
    skill_gaps: List[SkillGapDetail] = Field(description="Skills gaps in the market")
    emerging_skills: List[EmergingSkill] = Field(description="Emerging skills")
    total_unique_skills: int = Field(description="Total unique skills")
    avg_skills_per_job: float = Field(description="Average skills per job")
    avg_skills_per_candidate: float = Field(description="Average skills per candidate")

class MonthlyTrend(BaseModel):
    """Monthly trend data point"""
    month: str = Field(description="Month in YYYY-MM format")
    month_name: str = Field(description="Full month name")
    year: int = Field(description="Year")
    comparisons: int = Field(description="Number of comparisons in this month")
    jobs_created: int = Field(description="Number of jobs created in this month")
    avg_score: float = Field(description="Average ATS score for this month")
    high_scoring_candidates: int = Field(description="Number of candidates with score >= 80")

class GrowthMetrics(BaseModel):
    """Growth metrics comparing recent periods"""
    comparisons_growth: float = Field(description="Percentage growth in comparisons")
    jobs_growth: float = Field(description="Percentage growth in job postings")
    score_improvement: float = Field(description="Change in average scores")

class HiringTrends(BaseModel):
    """Complete hiring trends analysis"""
    monthly_trends: List[Dict[str, Any]] = Field(description="Monthly trend data")
    overall_growth: Dict[str, Any] = Field(description="Growth metrics")
    seasonal_patterns: Dict[str, Any] = Field(description="Seasonal patterns")
    predictions: Dict[str, Any] = Field(description="Predictions")

class JobPerformanceMetric(BaseModel):
    """Performance metrics for a specific job"""
    job_id: str = Field(description="Job identifier")
    job_title: str = Field(description="Job title")
    company: str = Field(description="Company name")
    total_applications: int = Field(description="Total number of applications received")
    completed_reviews: int = Field(description="Number of completed reviews")
    avg_score: float = Field(description="Average ATS score for this job")
    high_scoring_candidates: int = Field(description="Number of candidates with score >= 80")
    top_score: float = Field(description="Highest ATS score for this job")
    created_at: str = Field(description="Job creation timestamp")
    status: str = Field(description="Current job status")

class RecruiterInsightSummary(BaseModel):
    """Summary metrics for recruiter insights"""
    quality_candidate_rate: float = Field(description="Percentage of high-scoring candidates")
    challenging_positions: int = Field(description="Number of positions with low average scores")
    active_job_count: int = Field(description="Number of active job postings")

class Recommendation(BaseModel):
    """Actionable recommendation for recruiters"""
    type: str = Field(description="Type of recommendation")
    title: str = Field(description="Recommendation title")
    description: str = Field(description="Detailed description")

class ChallengingPosition(BaseModel):
    """Job position that's challenging to fill"""
    job_title: str = Field(description="Job title")
    company: str = Field(description="Company name")
    avg_score: float = Field(description="Average ATS score")
    applications: int = Field(description="Number of applications")

class ActionableInsight(BaseModel):
    """Specific actionable insight based on data analysis"""
    type: str = Field(description="Type of insight")
    priority: str = Field(description="Priority level (high, medium, low)")
    title: str = Field(description="Insight title")
    description: str = Field(description="Detailed description")
    action: str = Field(description="Recommended action")

class RecruiterInsights(BaseModel):
    """Complete recruiter insights package"""
    key_insights: List[Dict[str, Any]] = Field(description="Key insights")
    recommendations: List[Dict[str, Any]] = Field(description="Recommendations")
    market_insights: Dict[str, Any] = Field(description="Market insights")
    challenging_positions: List[Dict[str, Any]] = Field(description="Challenging positions")

class AnalyticsChartData(BaseModel):
    """Generic chart data structure"""
    labels: List[str] = Field(description="Chart labels")
    datasets: List[Dict[str, Any]] = Field(description="Chart datasets")
    chart_type: str = Field(description="Type of chart (bar, line, pie, etc.)")
    title: str = Field(description="Chart title")
    description: Optional[str] = Field(description="Chart description")

class AnalyticsDashboard(BaseModel):
    """Complete analytics dashboard data"""
    overview: OverviewMetrics = Field(description="Overview metrics")
    score_distribution: ScoreDistribution = Field(description="Score distribution analysis")
    skills_analytics: SkillsAnalytics = Field(description="Skills analysis")
    hiring_trends: HiringTrends = Field(description="Hiring trends over time")
    job_performance: List[JobPerformanceMetric] = Field(description="Job performance metrics")
    recruiter_insights: RecruiterInsights = Field(description="Actionable insights")
    generated_at: datetime = Field(default_factory=datetime.now, description="When this dashboard was generated")
    
class AnalyticsRequest(BaseModel):
    """Request parameters for analytics"""
    days: Optional[int] = Field(default=30, description="Number of days to analyze")
    months: Optional[int] = Field(default=12, description="Number of months for trends")
    include_inactive_jobs: Optional[bool] = Field(default=False, description="Include inactive jobs in analysis")
    min_applications: Optional[int] = Field(default=1, description="Minimum applications per job for analysis")

class AnalyticsExport(BaseModel):
    """Export configuration for analytics data"""
    format: str = Field(description="Export format (csv, json, pdf)")
    sections: List[str] = Field(description="Sections to include")
    date_range: Optional[Dict[str, str]] = Field(description="Date range filter")
    filters: Optional[Dict[str, Any]] = Field(description="Additional filters")
