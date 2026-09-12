import React from 'react';
import { Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
    content: string;
    maxWidth?: string;
    iconSize?: string;
    iconClassName?: string;
    contentClassName?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({
    content,
    maxWidth = "max-w-xs",
    iconSize = "h-3 w-3",
    iconClassName = "text-slate-400 hover:text-slate-600 cursor-pointer",
    contentClassName = "text-xs"
}) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Info className={`${iconSize} ${iconClassName}`} />
                </TooltipTrigger>
                <TooltipContent className={`${maxWidth} ${contentClassName}`}>
                    <p>{content}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export default InfoTooltip;