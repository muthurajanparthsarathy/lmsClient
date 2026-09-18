import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button"; // Assuming you're using this elsewhere

export function UserPagination({
    pagination,
    currentPage,
    usersPerPage,
    isLoadingUsers,
    paginate,
}: {
    pagination: { totalUsers: number; totalPages: number; hasPrevPage: boolean; hasNextPage: boolean };
    currentPage: number;
    usersPerPage: number;
    isLoadingUsers: boolean;
    paginate: (page: number) => void;
}) {
    if (pagination.totalUsers === 0) return null;

    const start = (currentPage - 1) * usersPerPage + 1;
    const end = Math.min(currentPage * usersPerPage, pagination.totalUsers);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-sm">
            {/* Status */}
            <div className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-0">
                Showing <span className="font-medium">{start}</span> to{" "}
                <span className="font-medium">{end}</span> of{" "}
                <span className="font-medium">{pagination.totalUsers}</span> users
            </div>

            {/* Pagination */}
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                paginate(currentPage - 1);
                            }}
                            className={`${!pagination.hasPrevPage || isLoadingUsers ? "pointer-events-none opacity-50" : ""}`}
                        />
                    </PaginationItem>

                    {Array.from({ length: pagination.totalPages }, (_, i) => {
                        const page = i + 1;
                        return (
                            <PaginationItem key={page}>
                                <PaginationLink
                                    href="#"
                                    isActive={page === currentPage}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        paginate(page);
                                    }}
                                >
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        );
                    })}

                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                paginate(currentPage + 1);
                            }}
                            className={`${!pagination.hasNextPage || isLoadingUsers ? "pointer-events-none opacity-50" : ""}`}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}
