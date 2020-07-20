# figure-layout

This extension may be useful to matplotlib users who want to create intricate plot layouts, such as for scientific publications, which would normally be more convenient in a non-python graphical tool such as Inkscape or Photoshop. 

## Installation
This extension relies on the infrastructure of jupyter nbextensions: https://jupyter-contrib-nbextensions.readthedocs.io/en/latest/install.html. Therefore, you must have jupyter nbextensions installed to use this library. 

- Follow the instructions in the above link. 
- Once jupyter nbextensions is installed, run `install.py` in this directory. This will attempt to find the "official" extensions and make a symbolic link (shortcut) to this folder. 
- To enable the extension, start `jupyter notebook`, click the `Nbextensions` tab in the jupyter home page, and enable the "Figure layout" extension.
- Open a new notebook and begin using the widget!

## Usage
Begin with an empty notebook cell and press the icon on the far right which looks like two desktop windows. 
![Inject canvas](readme-images/inject-canvas.png)


### Creating a subplot
You can use your mouse to create an initial subplot:
![Initial subplot](readme-images/init-subplot.gif)

### Splitting and resizing subplots
If you click on a subplot, you "select" it, as indicated by the border in red. When a subplot is selected, some sublot-specific actions become available as listed below the canvas. In this simple demo, we'll split our first subplot into two components and resize them by dragging edges:
![split-and-drag-edges](readme-images/split-and-drag-edges.gif)

### Moving subplots (and keyboard shortcuts)
Now we can create some inset plots. If you select a subplot, you can
- press 'd' to delete it
- use the arrow keys to move it
- press ctrl + c to make a copy, then click where to paste

![inset-creation](readme-images/inset-creation.gif)

You can also select and drag sublplots with the mouse to reposition them

### Labeling
We can adjust the automatically-assigned labels to whatever we like (removing them entirely from the insets)
![relabel](readme-images/relabel.gif)

### Alignment
Lastly, the alignment tool can be used to ensure that two subplots share the same reference point (left edge position, right edge position, etc.)

![align](readme-images/align.gif)


### Code generation
When you're satisfied with your layout, press the "Generate python cell" button to create a cell with equivalent python/matplotlib code. 

![render](readme-images/render.gif)

### Saving and reloading
If you reload the page, the canvas will disappear. However, the widget automatically saves your place in the cell holding the canvas. This lets you pick up where you left off if you want to make any changes:

![GIF of reloading and restoring](readme-images/save-and-load.gif)
