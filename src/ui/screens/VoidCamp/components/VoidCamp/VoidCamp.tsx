import { ReactNode } from "react";
import "./VoidCamp.css";

interface VoidCampProps {
  sidebar: ReactNode;
  content: ReactNode;
}

export const VoidCamp: React.FC<VoidCampProps> = ({ sidebar, content }) => {
  return (
    <div className="void-camp app-screen layout-split">
      <aside className="void-camp__sidebar">{sidebar}</aside>
      <section className="void-camp__content">{content}</section>
    </div>
  );
};
