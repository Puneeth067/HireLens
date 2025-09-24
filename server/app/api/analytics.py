from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from typing import Optional, List
import io
import csv
import json
from datetime import datetime

from app.models.analytics import (
    OverviewMetrics, ScoreDistribution, SkillsAnalytics, HiringTrends,
    JobPerformanceMetric, RecruiterInsights, AnalyticsDashboard,
    AnalyticsRequest, AnalyticsExport, AnalyticsChartData
)
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/overview", response_model=OverviewMetrics)
async def get_overview_metrics(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to analyze")
):
    """Get high-level overview metrics for the dashboard"""
    try:
        metrics = analytics_service.get_overview_metrics(days=days)
        return OverviewMetrics(**metrics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting overview metrics: {str(e)}")

@router.get("/scores/distribution", response_model=ScoreDistribution)
async def get_score_distribution():
    """Get ATS score distribution data for charts"""
    try:
        distribution_data = analytics_service.get_score_distribution()
        return ScoreDistribution(**distribution_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting score distribution: {str(e)}")

@router.get("/skills", response_model=SkillsAnalytics)
async def get_skills_analytics():
    """Get comprehensive skills analytics including demand, supply, and gaps"""
    try:
        skills_data = analytics_service.get_skills_analytics()
        return SkillsAnalytics(**skills_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting skills analytics: {str(e)}")

@router.get("/trends", response_model=HiringTrends)
async def get_hiring_trends(
    months: int = Query(default=12, ge=1, le=24, description="Number of months to analyze")
):
    """Get hiring trends over time with monthly breakdowns"""
    try:
        trends_data = analytics_service.get_hiring_trends(months=months)
        return HiringTrends(**trends_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting hiring trends: {str(e)}")

@router.get("/jobs/performance", response_model=List[JobPerformanceMetric])
async def get_job_performance_metrics():
    """Get performance metrics for all jobs"""
    try:
        performance_data = analytics_service.get_job_performance_metrics()
        return [JobPerformanceMetric(**job) for job in performance_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting job performance metrics: {str(e)}")

@router.get("/insights", response_model=RecruiterInsights)
async def get_recruiter_insights():
    """Get actionable insights and recommendations for recruiters"""
    try:
        insights_data = analytics_service.get_recruiter_insights()
        return RecruiterInsights(**insights_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting recruiter insights: {str(e)}")

@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_complete_dashboard(
    days: int = Query(default=30, ge=1, le=365, description="Days for overview metrics"),
    months: int = Query(default=12, ge=1, le=24, description="Months for trend analysis")
):
    """Get complete analytics dashboard with all metrics"""
    try:
        # Gather all analytics data
        overview = analytics_service.get_overview_metrics(days=days)
        score_distribution = analytics_service.get_score_distribution()
        skills_analytics = analytics_service.get_skills_analytics()
        hiring_trends = analytics_service.get_hiring_trends(months=months)
        job_performance = analytics_service.get_job_performance_metrics()
        recruiter_insights = analytics_service.get_recruiter_insights()
        
        # Create complete dashboard
        dashboard = AnalyticsDashboard(
            overview=OverviewMetrics(**overview),
            score_distribution=ScoreDistribution(**score_distribution),
            skills_analytics=SkillsAnalytics(**skills_analytics),
            hiring_trends=HiringTrends(**hiring_trends),
            job_performance=[JobPerformanceMetric(**job) for job in job_performance],
            recruiter_insights=RecruiterInsights(**recruiter_insights)
        )
        
        return dashboard
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating dashboard: {str(e)}")

@router.get("/charts/score-distribution", response_model=AnalyticsChartData)
async def get_score_distribution_chart():
    """Get chart data for score distribution visualization"""
    try:
        distribution = analytics_service.get_score_distribution()
        
        chart_data = AnalyticsChartData(
            labels=[item["range"] for item in distribution["distribution"]],
            datasets=[{
                "label": "Candidates",
                "data": [item["count"] for item in distribution["distribution"]],
                "backgroundColor": ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"],
                "borderColor": ["#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#059669"],
                "borderWidth": 1
            }],
            chart_type="bar",
            title="ATS Score Distribution",
            description="Distribution of candidates across different ATS score ranges"
        )
        
        return chart_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating chart data: {str(e)}")

@router.get("/charts/skills-demand", response_model=AnalyticsChartData)
async def get_skills_demand_chart():
    """Get chart data for top demanded skills"""
    try:
        skills = analytics_service.get_skills_analytics()
        top_skills = skills["top_demanded_skills"][:10]
        
        chart_data = AnalyticsChartData(
            labels=[skill["skill"] for skill in top_skills],
            datasets=[{
                "label": "Demand Score",
                "data": [skill["demand"] for skill in top_skills],
                "backgroundColor": "#3b82f6",
                "borderColor": "#2563eb",
                "borderWidth": 1
            }],
            chart_type="horizontalBar",
            title="Top 10 Most Demanded Skills",
            description="Skills with highest demand across all job postings"
        )
        
        return chart_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating skills chart: {str(e)}")

@router.get("/charts/hiring-trends", response_model=AnalyticsChartData)
async def get_hiring_trends_chart(
    months: int = Query(default=6, ge=3, le=12, description="Number of months to show")
):
    """Get chart data for hiring trends over time"""
    try:
        trends = analytics_service.get_hiring_trends(months=months)
        monthly_data = sorted(trends["monthly_trends"], key=lambda x: x["month"])[-months:]
        
        chart_data = AnalyticsChartData(
            labels=[data["month_name"] for data in monthly_data],
            datasets=[
                {
                    "label": "Comparisons",
                    "data": [data["comparisons"] for data in monthly_data],
                    "borderColor": "#3b82f6",
                    "backgroundColor": "rgba(59, 130, 246, 0.1)",
                    "tension": 0.4
                },
                {
                    "label": "Jobs Created",
                    "data": [data["jobs_created"] for data in monthly_data],
                    "borderColor": "#10b981",
                    "backgroundColor": "rgba(16, 185, 129, 0.1)",
                    "tension": 0.4
                }
            ],
            chart_type="line",
            title="Hiring Activity Trends",
            description="Monthly trends in comparisons and job creation"
        )
        
        return chart_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating trends chart: {str(e)}")

@router.post("/export")
async def export_analytics_data(
    export_config: AnalyticsExport,
    background_tasks: BackgroundTasks
):
    """Export analytics data in various formats"""
    try:
        if export_config.format not in ["csv", "json"]:
            raise HTTPException(status_code=400, detail="Unsupported export format. Use 'csv' or 'json'.")
        
        # Get complete dashboard data
        dashboard = await get_complete_dashboard()
        
        if export_config.format == "csv":
            return await _export_to_csv(dashboard, export_config)
        else:  # json
            return await _export_to_json(dashboard, export_config)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting data: {str(e)}")

async def _export_to_csv(dashboard: AnalyticsDashboard, config: AnalyticsExport):
    """Export dashboard data to CSV format"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Overview metrics
    if "overview" in config.sections:
        writer.writerow(["=== OVERVIEW METRICS ==="])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Total Candidates", dashboard.overview.total_candidates])
        writer.writerow(["Total Active Jobs", dashboard.overview.total_active_jobs])
        writer.writerow(["Total Comparisons", dashboard.overview.total_comparisons])
        writer.writerow(["Average ATS Score", dashboard.overview.average_ats_score])
        writer.writerow([])
    
    # Job performance
    if "job_performance" in config.sections:
        writer.writerow(["=== JOB PERFORMANCE ==="])
        writer.writerow(["Job Title", "Company", "Applications", "Avg Score", "High Scoring Candidates"])
        for job in dashboard.job_performance:
            writer.writerow([
                job.job_title, job.company, job.total_applications, 
                job.avg_score, job.high_scoring_candidates
            ])
        writer.writerow([])
    
    # Skills analytics
    if "skills" in config.sections:
        writer.writerow(["=== TOP DEMANDED SKILLS ==="])
        writer.writerow(["Skill", "Demand", "Jobs Count"])
        for skill in dashboard.skills_analytics.top_demanded_skills:
            writer.writerow([skill.skill, skill.demand, skill.jobs_count])
        writer.writerow([])
    
    csv_content = output.getvalue()
    output.close()
    
    return {
        "content": csv_content,
        "filename": f"analytics_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        "content_type": "text/csv"
    }

async def _export_to_json(dashboard: AnalyticsDashboard, config: AnalyticsExport):
    """Export dashboard data to JSON format"""
    # Filter sections based on config
    export_data = {}
    
    if "overview" in config.sections:
        export_data["overview"] = dashboard.overview.dict()
    if "score_distribution" in config.sections:
        export_data["score_distribution"] = dashboard.score_distribution.dict()
    if "skills" in config.sections:
        export_data["skills_analytics"] = dashboard.skills_analytics.dict()
    if "trends" in config.sections:
        export_data["hiring_trends"] = dashboard.hiring_trends.dict()
    if "job_performance" in config.sections:
        export_data["job_performance"] = [job.dict() for job in dashboard.job_performance]
    if "insights" in config.sections:
        export_data["recruiter_insights"] = dashboard.recruiter_insights.dict()
    
    export_data["exported_at"] = datetime.now().isoformat()
    export_data["export_config"] = config.dict()
    
    return {
        "content": json.dumps(export_data, indent=2),
        "filename": f"analytics_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        "content_type": "application/json"
    }

@router.get("/health")
async def analytics_health_check():
    """Health check for analytics service"""
    try:
        # Test basic analytics functions
        overview = analytics_service.get_overview_metrics(days=7)
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "analytics_service": "operational",
            "data_available": {
                "has_comparisons": overview["total_comparisons"] > 0,
                "has_jobs": overview["total_active_jobs"] >= 0,
                "has_candidates": overview["total_candidates"] >= 0
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "analytics_service": "error"
        }