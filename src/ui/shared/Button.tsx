import { PropsWithChildren } from "react";
import "./Button.css";

interface ButtonProps extends PropsWithChildren {
  onClick?: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, onClick, disabled }) => {
  return (
    <button className="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};
