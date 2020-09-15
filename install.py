import sys
try:
    from jupyter_core.paths import jupyter_config_path
except ImportError:
    raise ImportError("Could not import jupyter paths, is it installed?")

import os, platform

try:
    jupyter_config_path()
except:
    raise Exception("Could not find jupyter data directory!")
    sys.exit(1)

nbext_path = ''
for path in jupyter_config_path():
	p = os.path.join(path, 'nbextensions')
	if os.path.exists(p):
		nbext_path = p
		break

if nbext_path == '':
    raise Exception("Could not find jupyter-contrib-nbextensions install path, is it installed?")
    sys.exit(1)

print("Installing to %s using symbolic link (shortcut).\nYou may have to run as administrator if on windows or depending on your jupyter installation" % nbext_path)

extension_name = os.path.abspath('.').split('\\')[-1]

# make symlink
link = os.path.join(nbext_path, extension_name)
if os.path.exists(link):
    print("Cannot create symbolic link because there's already an extension with this name!")
    sys.exit(1)

if os.name == 'nt':
    symlink_cmd = "mklink /D {link} {target}".format(
        link=link, target=os.path.abspath('.'))
    print("Running symlink creation command: %s" % symlink_cmd)
    resp = os.popen(symlink_cmd)
    print("Symlink command response:")
    print(resp.readlines())
else:
    os.symlink(os.path.abspath('.'), link, target_is_directory=True)
