import "react-joyride";

declare module "react-joyride" {
  // The runtime supports enabling clicks on spotlighted targets,
  // but the published type definitions are missing this prop.
  interface JoyrideProps {
    spotlightClicks?: boolean;
  }
}
