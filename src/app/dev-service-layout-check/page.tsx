"use client"
import React, { useRef, useState } from 'react'
import MappingFormSection from '../lms/pages/servicemapping/components/MappingFormSection'
import DegreeSetupForm from '../lms/pages/servicemapping/components/DegreeSetupForm'
import DegreeWorkbench from '../lms/pages/servicemapping/components/HierarchyBuilder/DegreeWorkbench'
import { blankCourse, type CourseApi, type CourseEntry, type DegreeView } from '../lms/pages/servicemapping/components/HierarchyBuilder/types'
import { departmentSemesterPath, studentGroupErrors, type StudentGroupStore } from '../lms/pages/servicemapping/components/HierarchyBuilder/studentGroups'

export default function Check() {
    const [open, setOpen] = useState({ service: true, layout: true })
    const [groups, setGroups] = useState<StudentGroupStore>({})
    const [errors, setErrors] = useState<Record<string,string>>({})
    const [departmentNames, setDepartmentNames] = useState(['CSE'])
    const [semesters, setSemesters] = useState(['1'])
    const names = ['Programming in C', 'Mathematics I', 'Physics', 'English']
    const path = departmentSemesterPath('B.E', 'CSE', '1')
    const [courses, setCourses] = useState<Record<string,CourseEntry[]>>({ [path]: names.map((courseName) => ({ ...blankCourse(), courseName })) })
    const ref = useRef<(() => void) | null>(null)
    const degree: DegreeView = { name: 'B.E', startYear: '2026', endYear: '2030', durationKnown: true, semesterOptions: ['1','2','3','4','5','6','7','8'], semesters, departments: departmentNames, departmentOptions: ['CSE','ECE'], sectionsFor: () => [] }
    const api: CourseApi = {
        allCourseNames: names, coursesAt: (p) => courses[p] || [],
        setCount: (p,n) => setCourses((old) => ({...old,[p]: Array.from({length:n},(_,i)=>old[p]?.[i] || blankCourse())})),
        removeAt: (p,i) => setCourses((old) => ({...old,[p]: old[p].filter((_,j)=>j!==i)})),
        update: (p,i,patch) => setCourses((old)=>({...old,[p]:old[p].map((c,j)=>j===i?{...c,...patch}:c)})),
        setBatchCount:()=>{}, setBatchName:()=>{}, errorAt:()=>undefined, batchErrorAt:()=>undefined,
        filledCountUnder:()=>({filled:0,total:0}), errorCountUnder:()=>0,
    }
    return <div className="fixed inset-0 bg-ink-900/40 flex items-center justify-center p-4">
        <div role="dialog" aria-label="Service layout component check" className="bg-surface rounded-xl border border-hairline shadow-xl w-full flex flex-col overflow-hidden h-[92vh] max-w-[1440px]">
            <h2 className="px-5 py-4 border-b border-hairline font-semibold">Map service · Sample data</h2>
            <div className="flex-1 min-h-0 overflow-auto bg-surface-sunken p-5 space-y-4">
                <div className="flex justify-between"><p className="text-xs text-subtle">Choose a service and configure its layout below.</p><button type="button" className="text-sm text-brand-700" onClick={()=>{const v=!open.service||!open.layout;setOpen({service:v,layout:v})}}>{open.service&&open.layout?'Collapse all':'Expand all'}</button></div>
                <MappingFormSection id="sample-service" title="Choose Service" summary="Sample institution · Degree Program" open={open.service} onToggle={()=>setOpen({...open,service:!open.service})}>
                    <div className="grid sm:grid-cols-4 gap-4">{['Business model','Client','Service model','Service offering date & year'].map((label,i)=><label key={label} className="text-sm text-heading space-y-2 block">{label}<input aria-label={label} defaultValue={['Business to Institution (B2I)','Sample institution','Degree Program','24 Sept 2026'][i]} className="block w-full border border-hairline-strong rounded-lg h-10 px-3 text-sm" /></label>)}</div>
                </MappingFormSection>
                <MappingFormSection id="sample-layout" title="Service Layout" summary="B.E · CSE" open={open.layout} onToggle={()=>setOpen({...open,layout:!open.layout})}>
                    <DegreeSetupForm degree={degree} degreeOptions={['B.E']} degreesConfigured durationYears={4} onChooseDegree={()=>{}} onSetStartYear={()=>{}} onSetEndYear={()=>{}}
                        onToggleDepartment={(name)=>setDepartmentNames((old)=>old.includes(name)?old.filter((n)=>n!==name):[...old,name])} departmentDataCount={()=>({sections:0,courses:0})}
                        semesterDateFor={()=>({start:'',end:''})} onSemesterDate={()=>{}} semesterDateError={()=>undefined} academicBounds={null} semesterLock={()=>({state:'active',canEditStart:true,canEditEnd:true})}
                        chosenSemesters={semesters} semesterStatus={()=>({status:'available'})} activeSemester={semesters.at(-1)||''} onToggleSemester={(sem)=>setSemesters([sem])} fieldErrors={errors} revealErrorsRef={ref}>
                        <DegreeWorkbench degree={degree} courseApi={api} editableSemester={semesters.at(-1)||null} groups={groups} onChangeGroups={(p,s)=>{setGroups({...groups,[p]:s});setErrors({})}} onRemoveLegacySection={()=>{}} fieldErrors={errors}/>
                    </DegreeSetupForm>
                </MappingFormSection>
            </div>
            <div className="px-5 py-3 border-t border-hairline flex justify-end"><button className="rounded-lg bg-brand-700 text-white px-5 py-2" onClick={()=>setErrors(studentGroupErrors(groups))}>Validate sample</button></div>
        </div>
    </div>
}
