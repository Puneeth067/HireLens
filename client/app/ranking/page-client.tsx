'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cachedApiService } from '@/lib/cached-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Search, Users, TrendingUp, Plus, ArrowLeft, Trash2, Loader2 } from 'lucide-react'
import { 
  Job,
  JobDescriptionResponse, 
  RankingListResponse, 
  RankingStatisticsResponse,
  CandidateRanking,
  RankingCriteria
} from '@/lib/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from '@/hooks/use-toast'

export default function RankingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobDescriptionResponse[]>([])
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [rankings, setRankings] = useState<CandidateRanking[]>([])
  const [currentRanking, setCurrentRanking] = useState<CandidateRanking | null>(null)
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRequirements, setFilterRequirements] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('rank')
  const [loading, setLoading] = useState(false)
  const [deletingRankingId, setDeletingRankingId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [statistics, setStatistics] = useState({
    total_rankings: 0,
    total_candidates: 0,
    average_score: 0,
    top_score: 0,
    candidates_meeting_requirements: 0
  })

  // Function to automatically create ranking criteria from job data
  const createRankingCriteriaFromJob = (job: Job): RankingCriteria => {
    return {
      skills_weight: job.weight_skills || 0.4,
      experience_weight: job.weight_experience || 0.3,
      education_weight: job.weight_education || 0.2,
      keyword_weight: job.weight_keywords || 0.1,
      require_degree: false, // Default value
      required_skills: job.required_skills || [],
      preferred_skills: job.preferred_skills || [],
    };
  };

  // Function to automatically create a ranking for a job
  const autoCreateRanking = async (jobId: string) => {
    // Prevent multiple simultaneous ranking creations
    if (loading) return;
    
    setLoading(true);
    try {
      // Fetch job details to get criteria
      const jobDetails: Job = await cachedApiService.getJob(jobId);
      
      // Create ranking criteria from job data
      const criteria = createRankingCriteriaFromJob(jobDetails);
      
      // Get resume IDs associated with the job
      let resumeIds: string[] = [];
      
      // Check if job has associated resumes
      if (jobDetails.resumes && jobDetails.resumes.length > 0) {
        resumeIds = jobDetails.resumes;
      } else {
        // Fallback: Fetch all parsed resumes and filter for completed ones
        const parsedResumesResponse = await cachedApiService.getParsedResumes();
        const parsedResumes = parsedResumesResponse.resumes;
        
        // Filter resumes that are completed
        const jobResumes = parsedResumes.filter(resume => 
          resume.parsing_status === 'completed'
        );
        
        resumeIds = jobResumes.map(resume => resume.id);
      }

      if (resumeIds.length === 0) {
        toast({
          title: "No Resumes Found",
          description: "No parsed resumes found for this job. Please upload and parse resumes first.",
          variant: "destructive",
        });
        return;
      }

      // Create the ranking
      const response = await cachedApiService.createRanking(jobId, resumeIds, criteria);
      
      if (response.ranking_id && response.ranking_id !== '') {
        toast({
          title: "Success",
          description: "Ranking created automatically!",
        });
        // Refresh rankings after creation
        setTimeout(() => {
          fetchRankings();
          fetchStatistics();
        }, 1000);
      } else {
        toast({
          title: "Error",
          description: "Failed to create ranking automatically.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating automatic ranking:', error);
      toast({
          title: "Error",
          description: "Failed to create ranking automatically. Please try again.",
          variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const data = await cachedApiService.getJobs({ status: 'active' })
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    }
  }

  
  const fetchRankings = useCallback(async () => {
    if (!selectedJob) return
    
    setLoading(true)
    try {
      const response: RankingListResponse = await cachedApiService.getRankingsByJob(selectedJob)
      setRankings(response.rankings || [])
      if (response.rankings && response.rankings.length > 0) {
        setCurrentRanking(response.rankings[0]) // Most recent ranking
      } else {
        // If no rankings exist, fetch raw candidates for the job
        const candidatesResponse = await cachedApiService.getCandidatesForJob(selectedJob)
        if (candidatesResponse.success && candidatesResponse.candidates.length > 0) {
          // Create a temporary ranking display with raw candidates
          const tempRanking: CandidateRanking = {
            id: 'temp',
            job_id: selectedJob,
            criteria: {
              skills_weight: 0.4,
              experience_weight: 0.3,
              education_weight: 0.2,
              keyword_weight: 0.1,
              require_degree: false,
              required_skills: [],
              preferred_skills: []
            },
            candidates: candidatesResponse.candidates.map((candidate, index) => ({
              ...candidate,
              rank: index + 1
            })),
            total_candidates: candidatesResponse.candidates.length,
            created_at: new Date().toISOString(),
            average_score: 0,
            median_score: 0,
            top_score: 0,
            candidates_meeting_requirements: 0
          }
          setCurrentRanking(tempRanking)
        } else {
          setCurrentRanking(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rankings:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedJob, setCurrentRanking]);

  const fetchStatistics = useCallback(async () => {
    if (!selectedJob) return
    
    try {
      const response: RankingStatisticsResponse = await cachedApiService.getRankingStatistics(selectedJob)
      setStatistics(response.statistics || {
        total_rankings: 0,
        total_candidates: 0,
        average_score: 0,
        top_score: 0,
        candidates_meeting_requirements: 0
      })
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
    }
  }, [selectedJob, setStatistics]);

  useEffect(() => {
    fetchJobs()
  }, [])

  // Effect to handle job selection from query parameters
  useEffect(() => {
    const jobId = searchParams.get('job');
    if (jobId && !selectedJob) {
      setSelectedJob(jobId);
    }
  }, [searchParams, selectedJob, fetchRankings, fetchStatistics]);
  
  // Modified effect to automatically create ranking when job is selected
  useEffect(() => {
    if (selectedJob) {
      fetchRankings();
      fetchStatistics();
    }
  }, [selectedJob, fetchRankings, fetchStatistics]);


  useEffect(() => {
    if (selectedJob) {
      fetchRankings();
      fetchStatistics();
    }
  }, [selectedJob, fetchRankings, fetchStatistics]);

  // const generateShortlist = async () => {
  //   if (!selectedJob) return
  //   
  //   setLoading(true)
  //   try {
  //     const response = await cachedApiService.getShortlistSuggestions(selectedJob, 10)
  //     if (response.success) {
  //       // Create a temporary ranking display for shortlist
  //       const shortlistRanking: CandidateRanking = {
  //         id: 'shortlist',
  //         job_id: selectedJob,
  //         criteria: {
  //           skills_weight: 0.4,
  //           experience_weight: 0.3,
  //           education_weight: 0.2,
  //           keyword_weight: 0.1,
  //           require_degree: false,
  //           required_skills: [],
  //           preferred_skills: []
  //         },
  //         candidates: response.suggestions || [],
  //         total_candidates: response.suggestions?.length || 0,
  //         created_at: new Date().toISOString(),
  //         average_score: 0,
  //         median_score: 0,
  //         top_score: 0,
  //         candidates_meeting_requirements: 0
  //       }
  //       setCurrentRanking(shortlistRanking)
  //     }
  //   } catch (error) {
  //     console.error('Failed to generate shortlist:', error)
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  const handleJobSelection = (jobId: string) => {
    setSelectedJob(jobId);
    // Reset current ranking when selecting a new job
    setCurrentRanking(null);
    // The useEffect will automatically handle ranking creation
  };

  const toggleCandidateSelection = (candidateId: string) => {
    const newSelection = new Set(selectedCandidates)
    if (newSelection.has(candidateId)) {
      newSelection.delete(candidateId)
    } else {
      newSelection.add(candidateId)
    }
    setSelectedCandidates(newSelection)
  }

  const handleFilterChange = (value: string) => {
    setFilterRequirements(value);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
  };

  const filteredAndSortedCandidates = () => {
    if (!currentRanking) return []
    
    const filtered = currentRanking.candidates.filter(candidate => {
      const matchesSearch = (candidate.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           candidate.resume_filename.toLowerCase().includes(searchTerm.toLowerCase())) ?? false
      
      const matchesRequirements = filterRequirements === 'all' ||
                                 (filterRequirements === 'meets' && candidate.meets_requirements) ||
                                 (filterRequirements === 'doesnt_meet' && !candidate.meets_requirements)
      
      return matchesSearch && matchesRequirements
    })

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rank':
          return a.rank - b.rank
        case 'score_desc':
          return b.composite_score - a.composite_score
        case 'score_asc':
          return a.composite_score - b.composite_score
        case 'name':
          return (a.candidate_name || '').localeCompare(b.candidate_name || '')
        default:
          return a.rank - b.rank
      }
    })

    return filtered
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getScoreBadgeColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const handleDeleteRanking = (rankingId: string) => {
    setDeletingRankingId(rankingId)
    setShowDeleteDialog(true)
  }

  const confirmDeleteRanking = async () => {
    if (!deletingRankingId) return

    try {
      const response = await cachedApiService.deleteRanking(deletingRankingId)
      if (response.success) {
        // Remove the deleted ranking from the state
        setRankings(prev => prev.filter(ranking => ranking.id !== deletingRankingId))
        // If the current ranking was deleted, clear it
        if (currentRanking?.id === deletingRankingId) {
          setCurrentRanking(null)
        }
        toast({
          title: "Success",
          description: "Ranking deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to delete ranking",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Failed to delete ranking:', error)
      toast({
          title: "Error",
          description: "Failed to delete ranking",
          variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(false)
      setDeletingRankingId(null)
    }
  }



  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Candidate Ranking</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Rank and compare candidates using advanced scoring algorithms
            </p>
          </div>
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="responsiveSm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden xs:inline">Back</span>
          </Button>
        </div>
      </div>

      {/* Job Selection */}
      <Card className="mb-6 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Job Position
          </CardTitle>
          <p className="text-sm text-gray-600">
            Select a job to automatically rank candidates based on the job&#39;s criteria. 
            Rankings are created automatically using the job&#39;s required skills, preferred skills, and ATS scoring weights.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select value={selectedJob} onValueChange={handleJobSelection}>
              <SelectTrigger className="flex-1 bg-white">
                <SelectValue placeholder="Choose a job position to rank candidates" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {jobs.map(job => (
                  <SelectItem 
                    key={job.id} 
                    value={job.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                  >
                    {job.title} at {job.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedJob && (
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Link href={`/ranking/create?job=${selectedJob}`}>
                  <Button 
                    variant="outline" 
                    size="responsiveSm"
                    className="hover:bg-gray-100 transition-colors w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden xs:inline">Customize Ranking</span>
                  </Button>
                </Link>
                <Button 
                  onClick={() => autoCreateRanking(selectedJob)} 
                  disabled={loading}
                  size="responsiveSm"
                  className="hover:bg-blue-600 transition-colors w-full sm:w-auto"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  {loading ? 'Creating...' : <span className="hidden xs:inline">Refresh Ranking</span>}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedJob && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card className="bg-white hover:shadow-md transition-shadow duration-200">
              <CardContent className="pt-4">
                <div className="flex items-center">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Total Rankings</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{statistics.total_rankings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-md transition-shadow duration-200">
              <CardContent className="pt-4">
                <div className="flex items-center">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Total Candidates</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{statistics.total_candidates}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-md transition-shadow duration-200">
              <CardContent className="pt-4">
                <div className="flex items-center">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600" />
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Average Score</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {statistics.average_score?.toFixed(1) || '0.0'}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-md transition-shadow duration-200">
              <CardContent className="pt-4">
                <div className="flex items-center">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-500">Meeting Requirements</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{statistics.candidates_meeting_requirements}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="ranking" className="space-y-4">
            <TabsList className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <TabsTrigger
                value="ranking"
                className="flex-1 text-sm font-medium px-4 py-2 rounded-md transition-all duration-200
                          hover:bg-gray-200
                          data-[state=active]:bg-blue-500 
                          data-[state=active]:text-white 
                          data-[state=active]:hover:bg-blue-600"
              >
                Current Ranking
              </TabsTrigger>

              {selectedCandidates.size > 0 && (
                <TabsTrigger
                  value="compare"
                  className="flex-1 text-sm font-medium px-4 py-2 rounded-md transition-all duration-200
                            hover:bg-gray-200
                            data-[state=active]:bg-blue-500 
                            data-[state=active]:text-white 
                            data-[state=active]:hover:bg-blue-600"
                >
                  Compare Candidates
                </TabsTrigger>
              )}

              <TabsTrigger
                value="history"
                className="flex-1 text-sm font-medium px-4 py-2 rounded-md transition-all duration-200
                          hover:bg-gray-200
                          data-[state=active]:bg-blue-500 
                          data-[state=active]:text-white 
                          data-[state=active]:hover:bg-blue-600"
              >
                Ranking History
              </TabsTrigger>
            </TabsList>


            <TabsContent value="ranking" className="space-y-4">
              {currentRanking && (
                <>
                  {/* Search and Filters */}
                  <Card className="bg-white">
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                              placeholder="Search candidates..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 bg-white"
                            />
                          </div>
                        </div>
                        
                        <Select value={filterRequirements} onValueChange={handleFilterChange}>
                          <SelectTrigger className="w-full sm:w-40 bg-white hover:bg-gray-50 transition-colors">
                            <SelectValue>
                              {filterRequirements === 'all' && 'All Candidates'}
                              {filterRequirements === 'meets' && 'Meets Requirements'}
                              {filterRequirements === 'doesnt_meet' && 'Doesn\'t Meet Requirements'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem 
                              value="all" 
                              className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                            >
                              All Candidates
                            </SelectItem>
                            <SelectItem 
                              value="meets" 
                              className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                            >
                              Meets Requirements
                            </SelectItem>
                            <SelectItem 
                              value="doesnt_meet" 
                              className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                            >
                              Doesn&apos;t Meet Requirements
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={handleSortChange}>
                          <SelectTrigger className="w-full sm:w-40 bg-white hover:bg-gray-50 transition-colors">
                            <SelectValue>
                              {sortBy === 'rank' && 'Sort by Rank'}
                              {sortBy === 'score_desc' && 'Score (High to Low)'}
                              {sortBy === 'score_asc' && 'Score (Low to High)'}
                              {sortBy === 'name' && 'Name (A-Z)'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem 
                              value="rank" 
                              className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                            >
                              Sort by Rank
                            </SelectItem>
                            <SelectItem 
                              value="score_desc" 
                              className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                            >
                              Score (High to Low)
                            </SelectItem>
                            <SelectItem 
                              value="score_asc" 
                              className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                            >
                              Score (Low to High)
                            </SelectItem>
                            <SelectItem 
                              value="name" 
                              className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                            >
                              Name (A-Z)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Candidates List */}
                  <div className="space-y-4">
                    {filteredAndSortedCandidates().map(candidate => (
                      <Card 
                        key={candidate.resume_id}
                        className={`transition-all duration-200 hover:shadow-lg hover:border-blue-300 cursor-pointer bg-white ${
                          selectedCandidates.has(candidate.resume_id) ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => toggleCandidateSelection(candidate.resume_id)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-4 flex-1">
                              <div className="flex-shrink-0">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                                  <span className="text-lg font-bold text-blue-800">
                                    #{candidate.rank}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="text-base font-semibold text-gray-900 truncate">
                                    {candidate.candidate_name || 'Unknown Candidate'}
                                  </h3>
                                  <div className="flex items-center space-x-2">
                                    <Badge 
                                      className={`${getScoreBadgeColor(candidate.composite_score)} text-white text-xs px-2 py-1`}
                                    >
                                      {candidate.composite_score.toFixed(1)}%
                                    </Badge>
                                    {candidate.meets_requirements ? (
                                      <Badge variant="outline" className="text-green-600 border-green-600 text-xs px-2 py-1">
                                        ✓ Qualified
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-gray-500 border-gray-500 text-xs px-2 py-1">
                                        Needs Review
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <p className="text-xs text-gray-500 mb-2 truncate">{candidate.resume_filename}</p>
                                
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-xs text-gray-500">Skills</p>
                                    <p className={`text-xs font-medium px-2 py-1 rounded ${getScoreColor(candidate.skills_score)}`}>
                                      {candidate.skills_score.toFixed(1)}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Experience</p>
                                    <p className={`text-xs font-medium px-2 py-1 rounded ${getScoreColor(candidate.experience_score)}`}>
                                      {candidate.experience_score.toFixed(1)}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Education</p>
                                    <p className={`text-xs font-medium px-2 py-1 rounded ${getScoreColor(candidate.education_score)}`}>
                                      {candidate.education_score.toFixed(1)}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Keywords</p>
                                    <p className={`text-xs font-medium px-2 py-1 rounded ${getScoreColor(candidate.keyword_score)}`}>
                                      {candidate.keyword_score.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {filteredAndSortedCandidates().length === 0 && (
                    <Card className="bg-white">
                      <CardContent className="pt-6 text-center py-12">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
                        <p className="text-gray-500">
                          Try adjusting your search terms or filters to find candidates.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {!currentRanking && !loading && (
                <Card className="bg-white">
                  <CardContent className="pt-6 text-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No ranking available</h3>
                    <p className="text-gray-500 mb-6">
                      Select a job above to automatically create a ranking based on the job&#39;s criteria.
                      Rankings are created automatically using the job&#39;s required skills, preferred skills, and ATS scoring weights.
                    </p>
                    <div className="flex justify-center gap-4">
                      {selectedJob ? (
                        <Button 
                          onClick={() => autoCreateRanking(selectedJob)}
                          disabled={loading}
                          className="hover:bg-blue-600 transition-colors"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <TrendingUp className="h-4 w-4 mr-2" />
                          )}
                          {loading ? 'Creating...' : 'Create Automatic Ranking'}
                        </Button>
                      ) : (
                        <p className="text-gray-500">Please select a job first</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {selectedCandidates.size > 0 && (
              <TabsContent value="compare" className="space-y-4">
                {selectedCandidates.size > 1 ? (
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>
                        Compare Selected Candidates ({selectedCandidates.size})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <p className="text-gray-600">
                          Compare the selected candidates side by side to make informed decisions.
                        </p>
                        <Link href={`/ranking/compare?job=${selectedJob}&candidates=${Array.from(selectedCandidates).join(',')}`}>
                          <Button className="hover:bg-blue-600 transition-colors">
                            Compare Now
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white">
                    <CardContent className="pt-6 text-center py-12">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Select more candidates to compare</h3>
                      <p className="text-gray-500 mb-4">
                        You need at least 2 candidates to perform a comparison.
                      </p>
                      <p className="text-gray-500">
                        Click on candidate cards in the ranking tab to select more candidates for comparison.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            <TabsContent value="history" className="space-y-4">
              {rankings.length > 0 ? (
                <div className="space-y-4">
                  {rankings.map(ranking => (
                    <Card key={ranking.id} className="bg-white hover:shadow-md transition-shadow duration-200">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">
                              Ranking from {new Date(ranking.created_at).toLocaleDateString()}
                            </h3>
                            <p className="text-gray-500">
                              {ranking.total_candidates} candidates • 
                              Average score: {ranking.average_score?.toFixed(1)}% •
                              {ranking.candidates_meeting_requirements} meeting requirements
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setCurrentRanking(ranking)}
                              className="hover:bg-gray-100 transition-colors"
                            >
                              View Ranking
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => handleDeleteRanking(ranking.id)}
                              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-white">
                  <CardContent className="pt-6 text-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No ranking history</h3>
                    <p className="text-gray-500">
                      Rankings you create will appear here for future reference.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {!selectedJob && (
        <Card className="bg-white">
          <CardContent className="pt-6 text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a job position</h3>
            <p className="text-gray-500">
              Choose a job position from the dropdown above to view and create candidate rankings.
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this ranking?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the ranking and remove it from your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteRanking}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}