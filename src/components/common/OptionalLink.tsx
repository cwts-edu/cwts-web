import type React from "react";
import type { ReactNode } from "react";

interface OptionalLinkProps {
  url?: string;
  newWindow?: boolean;
  children: ReactNode;
  className?: string;
}

const OptionalLink: React.FC<OptionalLinkProps> = ({
  url,
  newWindow = false,
  children,
  className,
}) => {
  if (url === undefined) {
    // If url is not provided, render the children as is
    return <>{children}</>;
  } else {
    if (className === undefined) {
          // If url is provided, wrap the children in an anchor element
      return (
        <a href={url} target={newWindow ? "_blank" : undefined}>
         {children}
        </a>
      );
    } else {

          // If url is provided, wrap the children in an anchor element
      return (
        <a href={url} className={className} target={newWindow ? "_blank" : undefined}>
          {children}
        </a>
      );
    }


  }
};

export default OptionalLink;
