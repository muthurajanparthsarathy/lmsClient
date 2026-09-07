"use client"

import { useState, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Poppins } from 'next/font/google'
import {
  ArrowLeft, Search, Users, Home, BookMarked, Layers, LayoutGrid,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import DashboardLayout from '@/app/lms/component/layout'
import { useCourseBatchesQuery } from '@/app/lms/pages/coursestructure/course-batches/queries/courseBatches'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
})

const PAGE_SIZE = 8

const sectionCodeOf = (index: number) => `SEC-${String(index + 1).padStart(3, '0')}`

// Sections page for degree-program courses. Sits between the Batches page
// and course-participants: batch → section → users. Sections are stored on
// the course document (sections[], mirrored from the client's degree config
// at course creation) — this page only lists them; nothing is created here.
export default function CourseSectionsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const courseId = searchParams.get('courseId')
  const batchId = searchParams.get('batchId')
  const batchName = searchParams.get('batchName')

  const [searchTerm, setSearchTerm] = useState('')

  // Same endpoint (and now the same cache entry) the Batches and Participants
  // pages read — it carries the course's degree / departmentSections /
  // semester alongside the batch list, so no extra route is needed.
  const { data: hierarchy, isLoading: loading, error: queryError, refetch: fetchSections } = useCourseBatchesQuery(courseId)
  const error = queryError
    ? (queryError as Error).message || 'Failed to load the course hierarchy'
    : null

  const courseName = hierarchy?.courseName || ''
  const degree = hierarchy?.degree || ''
  const semester = hierarchy?.semester || ''
  const departmentSections = useMemo(
    () => hierarchy?.departmentSections || [],
    [hierarchy]
  )

  // Filter the tree by search term (matches degree, department or section)
  const filteredDeptSections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return departmentSections
    return departmentSections
      .map((d) => {
        const deptMatch = d.department.toLowerCase().includes(term) || degree.toLowerCase().includes(term)
        const sections = deptMatch ? d.sections : d.sections.filter((s) => s.toLowerCase().includes(term))
        return { ...d, sections }
      })
      .filter((d) => d.sections.length > 0 || d.department.toLowerCase().includes(term))
  }, [departmentSections, searchTerm, degree])

  const totalSections = useMemo(
    () => departmentSections.reduce((n, d) => n + d.sections.length, 0),
    [departmentSections]
  )

  // Navigate to participant management scoped to a hierarchy node.
  const goToManageUsers = (ctx: { department?: string; section?: string }) => {
    const params: Record<string, string> = {
      courseId: courseId ?? '',
      batchId: batchId ?? '',
      batchName: batchName ?? '',
    }
    if (degree) params.degree = degree
    if (semester) params.semester = semester
    if (ctx.department) params.department = ctx.department
    if (ctx.section) params.section = ctx.section
    router.push(`/lms/pages/coursestructure/course-participants?${new URLSearchParams(params).toString()}`)
  }

  if (!courseId || !batchId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md border-red-100">
            <CardContent className="pt-6 text-center">
              <h3 className="font-medium text-gray-900 mb-1">No batch selected</h3>
              <p className="text-sm text-gray-600 mb-4">Open this page from a batch&apos;s Manage Participants action.</p>
              <Button variant="outline" size="sm" onClick={() => router.push('/lms/pages/coursestructure')} className="w-full">
                <ArrowLeft className="mr-2 h-3 w-3" />
                Go to Courses
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`${poppins.className} h-full flex flex-col bg-white overflow-hidden`}
      >
        {/* Breadcrumb */}
        <div className="px-4 pt-2">
          <Breadcrumb>
            <BreadcrumbList className="text-[11px]">
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/lms/pages/admindashboard"
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900"
                >
                  <Home className="h-3 w-3" />
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/lms/pages/coursestructure"
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900"
                >
                  <BookMarked className="h-3 w-3" />
                  Courses
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={`/lms/pages/coursestructure/course-batches?courseId=${courseId}`}
                  className="text-[11px] text-gray-500 hover:text-gray-900 truncate max-w-[180px]"
                >
                  {courseName || 'Course'}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={`/lms/pages/coursestructure/course-batches?courseId=${courseId}`}
                  className="text-[11px] text-gray-500 hover:text-gray-900"
                >
                  Batches
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[11px] font-medium text-gray-500 truncate max-w-[180px]">
                  {batchName || 'Batch'}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-gray-300" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[11px] font-medium text-gray-700">
                  Hierarchy
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Course + batch context */}
        <div className="px-4 pt-1.5 flex items-center justify-between gap-3">
          <div className="text-[13px] text-gray-800 min-w-0 flex items-center gap-2">
            <span>
              <span className="font-medium text-gray-500">Course Name:</span>{' '}
              <span className="font-semibold text-gray-900 truncate">{courseName}</span>
            </span>
            {batchName && (
              <Badge variant="outline" className="text-[10px] px-2 py-0 border-indigo-200 bg-indigo-50 text-indigo-700">
                Batch: {batchName}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 px-3 text-xs shrink-0"
            onClick={() => router.push(`/lms/pages/coursestructure/course-batches?courseId=${courseId}`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Batches
          </Button>
        </div>

        {/* Toolbar + table */}
        <div className="px-4 pt-3 flex-1 min-h-0 flex flex-col">
          <div className="border border-gray-200 rounded-lg flex-1 min-h-0 flex flex-col">
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search degree, department, section..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-xs rounded-full"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="h-8 px-3 flex items-center text-xs font-medium bg-gray-50">
                  {departmentSections.length} Dept · {totalSections} Section{totalSections === 1 ? '' : 's'}
                </Badge>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => goToManageUsers({})}
                  title="Add participants at the degree level (all departments & sections)"
                >
                  <Users className="h-3.5 w-3.5" />
                  Add at Degree
                </Button>
              </div>
            </div>

            {/* Hierarchy: Degree → Department → Section (semester shown as context) */}
            <div className="flex-1 min-h-0 overflow-auto p-3">
              {loading ? (
                <div className="py-16 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-3 text-sm text-gray-500">Loading course hierarchy...</p>
                </div>
              ) : error ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-red-600 mb-3">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => fetchSections()}>Retry</Button>
                </div>
              ) : departmentSections.length === 0 ? (
                <div className="py-16 text-center">
                  <LayoutGrid className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">No departments configured</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Departments &amp; sections come from the client&apos;s degree configuration,
                    picked in the course&apos;s Basic Configuration. Edit the course to select them.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Degree header */}
                  <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-semibold">
                        {(degree || 'D').charAt(0).toUpperCase()}
                      </span>
                      <span className="font-semibold text-gray-900">{degree || 'Degree'}</span>
                      {semester && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0 border-blue-200 bg-white text-blue-700">
                          Semester {semester}
                        </Badge>
                      )}
                      {batchName && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0 border-indigo-200 bg-white text-indigo-700">
                          Batch: {batchName}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 px-2.5 text-xs"
                      onClick={() => goToManageUsers({})}
                    >
                      <Users className="h-3.5 w-3.5" /> Add participants
                    </Button>
                  </div>

                  {/* Departments */}
                  {filteredDeptSections.map((dept) => (
                    <div key={dept.department} className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-6 h-6 rounded-md bg-violet-50 border border-violet-100 text-violet-700 font-semibold flex items-center justify-center">
                            {dept.department.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-gray-900">{dept.department}</span>
                          <span className="text-[11px] text-gray-400">
                            {dept.sections.length} section{dept.sections.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 px-2 text-xs text-indigo-600 hover:text-indigo-800"
                          title="Add participants for this department (all its sections)"
                          onClick={() => goToManageUsers({ department: dept.department })}
                        >
                          <Users className="h-3.5 w-3.5" /> Add participants
                        </Button>
                      </div>

                      {/* Sections */}
                      {dept.sections.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-gray-400">No sections</div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {dept.sections.map((sec) => (
                            <div key={sec} className="flex items-center justify-between px-3 py-2 pl-8 hover:bg-gray-50/60">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-5 h-5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-semibold flex items-center justify-center">
                                  {sec.charAt(0).toUpperCase()}
                                </span>
                                <span className="text-gray-800">Section {sec}</span>
                                {semester && <span className="text-[10px] text-gray-400">· Sem {semester}</span>}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1.5 px-2 text-xs text-indigo-600 hover:text-indigo-800"
                                title="Add participants for this section"
                                onClick={() => goToManageUsers({ department: dept.department, section: sec })}
                              >
                                <Users className="h-3.5 w-3.5" /> Add participants
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
