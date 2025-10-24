import { ReactNode } from "react";
import "./VoidCamp.css";

interface VoidCampProps {
  sidebar: ReactNode;
  content: ReactNode;
  topBar?: ReactNode;
}

export const VoidCamp: React.FC<VoidCampProps> = ({ sidebar, content, topBar }) => {
  return (
    <div className="void-camp app-screen layout-split">
      <aside className="void-camp__sidebar">{sidebar}</aside>
      <section className="void-camp__content">
        {topBar}
        <div className="void-camp__content-body">{content}</div>
      </section>
    </div>
  );
};
