import type React from "react";
import type { ReactNode } from "react";

interface OptionalLinkProps {
  url?: string;
  children: ReactNode;
}

const OptionalLink: React.FC<OptionalLinkProps> = ({ url, children }) => {
  if (url === undefined) {
    // If url is not provided, render the children as is
    return <>{children}</>;
  } else {
    // If url is provided, wrap the children in an anchor element
    return <a href={url}>{children}</a>;
  }
};

export default OptionalLink;
