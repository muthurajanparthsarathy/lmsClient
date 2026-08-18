import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BookOpen,
    Users,
    GraduationCap,
    TrendingUp,
    Calendar,
    Clock
} from "lucide-react";
import DashboardLayout from "../../components/layout";

// import DashboardLayout from "@/app/dashboard/adminlayout";
// import DashboardLayout from "../../component/layout";


export default function DashboardPage() {
    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Dashboard
                    </h1>
                    <p className="text-gray-600">
                        Welcome back! Here's what's happening with your courses today.
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">12</div>
                            <p className="text-xs text-muted-foreground">
                                +2 from last month
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">1,234</div>
                            <p className="text-xs text-muted-foreground">
                                +180 from last month
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">89%</div>
                            <p className="text-xs text-muted-foreground">
                                +12% from last month
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">$45,231</div>
                            <p className="text-xs text-muted-foreground">
                                +20% from last month
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Activity and Upcoming Events */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Recent Courses */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Courses</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                {
                                    title: "Advanced React Development",
                                    students: 156,
                                    status: "active",
                                    progress: 75
                                },
                                {
                                    title: "Introduction to TypeScript",
                                    students: 89,
                                    status: "active",
                                    progress: 45
                                },
                                {
                                    title: "Node.js Fundamentals",
                                    students: 234,
                                    status: "completed",
                                    progress: 100
                                }
                            ].map((course, index) => (
                                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-1">
                                        <h4 className="font-medium">{course.title}</h4>
                                        <p className="text-sm text-gray-600">{course.students} students</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={course.status === "active" ? "default" : "secondary"}>
                                            {course.status}
                                        </Badge>
                                        <span className="text-sm text-gray-600">{course.progress}%</span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Upcoming Events */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Upcoming Events</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                {
                                    title: "React Workshop",
                                    date: "Today, 2:00 PM",
                                    type: "Workshop"
                                },
                                {
                                    title: "Student Presentations",
                                    date: "Tomorrow, 10:00 AM",
                                    type: "Presentation"
                                },
                                {
                                    title: "Course Review Meeting",
                                    date: "Jun 16, 3:00 PM",
                                    type: "Meeting"
                                }
                            ].map((event, index) => (
                                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                                    <div className="flex-shrink-0">
                                        <Calendar className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <h4 className="font-medium">{event.title}</h4>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Clock className="h-3 w-3" />
                                            {event.date}
                                        </div>
                                    </div>
                                    <Badge variant="outline">{event.type}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            <Button>Create New Course</Button>
                            <Button variant="outline">Add Student</Button>
                            <Button variant="outline">Schedule Event</Button>
                            <Button variant="outline">Generate Report</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}