# figure-layout

This extension may be useful to matplotlib users who want to create intricate plot layouts, such as for scientific publications, which would normally be more convenient in a non-python graphical tool such as Inkscape or Photoshop. 

## Usage
Begin with an empty notebook cell and press the icon on the far right which looks like two desktop windows. 
![Inject canvas](readme-images/inject-canvas.png)

You can use your mouse to create an initial subplot:
![Initial subplot](readme-images/init-subplot.gif)

If you click on a subplot, you "select" it, as indicated by the border in red. When a subplot is selected, some sublot-specific actions become available as listed below the canvas. In this simple demo, we'll split our first subplot into two components and resize them by dragging edges:
![split-and-drag-edges](readme-images/split-and-drag-edges.gif)

Now we can create some inset plots. If you select a subplot, you can
- press 'd' to delete it
- use the arrow keys to move it
- press ctrl + c to make a copy, then click where to paste

![inset-creation](readme-images/inset-creation.gif)

We can adjust the automatically-assigned labels to whatever we like (removing them entirely from the insets)
![relabel](readme-images/relabel.gif)

Lastly, the alignment tool can be used to ensure that two subplots share the same reference point (left edge position, right edge position, etc.)

![align](readme-images/align.gif)

When you're satisfied with your layout, press the "Generate python cell" button to create a cell with equivalent python/matplotlib code. 

![render](readme-images/render.gif)

If you reload the page, the canvas will disappear. However, the widget automatically saves your place in the cell holding the canvas. This lets you pick up where you left off if you want to make any changes:

![GIF of reloading and restoring](readme-images/save-and-load.gif)