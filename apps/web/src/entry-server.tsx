import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { AppRoutes, type InitialPublicRender } from './AppRoutes';

export function render(url:string,initial:InitialPublicRender){
  return renderToString(<React.StrictMode><StaticRouter location={url}><AppRoutes initialPublicRender={initial}/></StaticRouter></React.StrictMode>);
}
