/** @type {import('tailwindcss').Config} */
module.exports = {
    // 1. Configure Content Sources:
    //    Tell Tailwind where your Svelte components and other files using Tailwind classes are.
    content: ['./src/**/*.{html,js,svelte,ts}'],
  
    // 2. Theme Customization (Optional):
    //    Extend the default theme here if needed. For just DaisyUI, you might not need much.
    theme: {
      extend: {
        // Example: Add a custom font or color
        // fontFamily: {
        //   sans: ['Inter', 'sans-serif'],
        // },
        // colors: {
        //   'custom-blue': '#1e40af',
        // }
      },
    },
  
    // 3. Add Plugins:
    //    This is where you enable DaisyUI.
    plugins: [
      require('daisyui'),
      // Add other plugins like typography if you use them:
      // require('@tailwindcss/typography'),
      // require('@tailwindcss/forms'),
    ],
  
    // 4. DaisyUI Configuration (Optional but Recommended):
    //    Customize DaisyUI behavior, like themes, logs, etc.
    daisyui: {
      themes: ["light", "dark"], // Specify the themes you want to use (or true for all)
      // themes: true, // enables all themes
      darkTheme: "dark", // name of one of the included themes for dark mode
      base: true, // applies background color and foreground color for root element by default
      styled: true, // include daisyUI colors and design decisions for all components
      utils: true, // adds responsive and modifier utility classes
      prefix: "", // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
      logs: true, // Shows info about daisyUI version and used config in the console when building your CSS
      themeRoot: ":root", // The element that receives theme color CSS variables
    },
  };