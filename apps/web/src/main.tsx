import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes, type InitialPublicRender } from './AppRoutes';
import './index.css';

const container=document.getElementById('root')!;
let initial:InitialPublicRender=null;
try{if(container.dataset.public)initial=JSON.parse(container.dataset.public) as InitialPublicRender;}catch{/* Client fallback fetches the public page. */}
const app=<React.StrictMode><BrowserRouter><AppRoutes initialPublicRender={initial}/></BrowserRouter></React.StrictMode>;
if(container.hasChildNodes()&&initial)ReactDOM.hydrateRoot(container,app);else ReactDOM.createRoot(container).render(app);
