import { Music } from 'lucide-react';
import type { ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  onClick?: () => void;
  icon?: ReactNode;
}

export default function Card({ title, subtitle, coverUrl, onClick, icon }: CardProps) {
  // Clone icon with hover class if it's a valid React element
  const iconWithHover = icon && isValidElement(icon) 
    ? cloneElement(icon as React.ReactElement<any>, {
        className: `${(icon as any).props.className || ''} group-hover:text-[#B93939] transition-colors`.trim()
      })
    : icon;

  return (
    <div
      onClick={onClick}
      className="
        bg-neutral-900        
        rounded-lg           
        p-4                  
        hover:bg-neutral-800 
        cursor-pointer       
        transition-all       
        group
        h-full
        flex
        flex-col
      "
    >
      {/* Cover Image */}
      <div className="
        aspect-square        
        bg-neutral-800      
        rounded-md          
        mb-4                
        overflow-hidden     
        relative
        group-hover:bg-[#B93939]/20
        transition-colors
      ">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {iconWithHover || <Music className="w-12 h-12 text-neutral-700 group-hover:text-[#B93939] transition-colors" />}
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="
        font-semibold
        text-white
        truncate             
        mb-1
        group-hover:text-[#B93939]
        transition-colors
      ">
        {title}
      </h3>

      {/* Subtitle */}
      {subtitle && (
        <p className="
          text-sm
          text-gray-400
          truncate
          line-clamp-2
        ">
          {subtitle}
        </p>
      )}
    </div>
  );
}